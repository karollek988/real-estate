"""Tests for api/translation.py - the offline translator behind POST /api/translate.

Everything here runs without the model (a stand-in takes its place), so the rules around the model - splitting,
the glossary, numbers, markers, whitespace - are checked on every run. The last test translates for real and is
skipped when the model has not been converted on this machine (it is in the Docker image).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import translation  # noqa: E402
from translation_glossary import glossary_for  # noqa: E402


def echo(sentences: list[str]) -> list[str]:
    """A stand-in model that returns each sentence as it came in (so the tests see what the model would see)."""
    return list(sentences)


# --- sentences -------------------------------------------------------------------------------------


def test_splits_after_a_full_stop_and_a_capital():
    assert translation.split_sentences("Första meningen. Andra meningen! Tredje?") == ["Första meningen.", "Andra meningen!", "Tredje?"]


def test_does_not_split_after_a_swedish_abbreviation():
    assert translation.split_sentences("Fråga t.ex. Mäklaren om det. Sedan nästa sak.") == ["Fråga t.ex. Mäklaren om det.", "Sedan nästa sak."]


def test_does_not_split_inside_a_marked_span():
    text = "Läs [1]Bra. Mycket bra[/1] och sedan resten."
    assert translation.split_sentences(text) == [text]


def test_a_decimal_number_is_not_a_sentence_end():
    assert translation.split_sentences("Räntan är 3.5 procent idag.") == ["Räntan är 3.5 procent idag."]


# --- numbers ---------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "swedish, english",
    [
        ("2 495 000 kr", "2,495,000 kr"),
        ("3,5 procent", "3.5 procent"),
        ("1 250 kr", "1,250 kr"),
        ("år 2026 och 14 maj", "år 2026 och 14 maj"),
        ("Budget upp till 8 000 000 kr", "Budget upp till 8,000,000 kr"),
    ],
)
def test_numbers_are_written_the_english_way(swedish, english):
    assert translation.localize_numbers(swedish, "en") == english


def test_numbers_are_left_alone_for_other_targets():
    assert translation.localize_numbers("3,5", "xx") == "3,5"


def test_prices_put_the_currency_first():
    assert translation.tidy_currency("It costs 499 SEK per year", "en") == "It costs SEK 499 per year"
    assert translation.tidy_currency("2,495,000 kr", "en") == "SEK 2,495,000"


def test_square_metres_keep_their_sign():
    assert translation.tidy_currency("55 m2 and 7 m2", "en") == "55 m² and 7 m²"


# --- the glossary ----------------------------------------------------------------------------------


def test_glossary_terms_are_protected_and_put_back_in_english():
    guarded = translation.protect_terms("Lagfart och pantbrev är kostnader.", "en")
    assert "[g1]Lagfart[/g1]" in guarded.text
    # the model leaves a protected span alone; the English term comes back in its place
    assert translation.restore_terms(guarded.text, guarded.replacements) == "Title registration (lagfart) och mortgage deeds är kostnader."


def test_a_term_is_never_wrapped_twice():
    guarded = translation.protect_terms("bostadsrättsföreningen", "en")
    assert guarded.text.count("[g") == 1
    assert guarded.replacements == {1: "the housing association"}


def test_the_brand_is_never_translated():
    out = translation.translate(["Köpanalys visar vad du köper."], "sv", "en", translate_sentences=lambda s: [x.replace("visar vad du köper", "shows what you buy") for x in s])
    assert out == ["Köpanalys shows what you buy."]


def test_room_counts_are_written_as_rooms():
    guarded = translation.protect_terms("Ljus 3:a med balkong", "en")
    assert translation.restore_terms(guarded.text, guarded.replacements) == "Ljus 3-room flat med balkong"


def test_a_lost_marker_is_cleaned_up_rather_than_shown():
    assert translation.restore_terms("The [g1]word and [/g2] more", {1: "x"}) == "The word and  more"


def test_there_is_no_glossary_for_an_unknown_language():
    assert glossary_for("xx") == []


# --- whole texts -----------------------------------------------------------------------------------


def test_line_breaks_and_the_whitespace_around_a_text_are_kept():
    out = translation.translate(["  Rad ett.\nRad två. Mer text.\n\nRad fyra.  "], "sv", "en", translate_sentences=echo)
    assert out == ["  Rad ett.\nRad två. Mer text.\n\nRad fyra.  "]


def test_markers_for_formatting_pass_through():
    text = "Läs mer om [1]skuldsättning[/1] och [2]räntan[/2]."
    out = translation.translate([text], "sv", "en", translate_sentences=lambda s: [x.replace("Läs mer om", "Read more about").replace("och", "and") for x in s])
    assert out[0].startswith("Read more about [1]debt level[/1] and [2]räntan[/2]")


def test_many_texts_come_back_in_order():
    texts = [f"Text nummer {i}." for i in range(70)]
    out = translation.translate(texts, "sv", "en", translate_sentences=lambda s: [x.upper() for x in s])
    assert out == [t.upper() for t in texts]


def test_an_empty_text_stays_empty():
    assert translation.translate(["", "   "], "sv", "en", translate_sentences=echo) == ["", "   "]


def test_a_language_pair_without_a_model_is_unavailable(monkeypatch):
    monkeypatch.setenv(translation.MODELS_DIR_ENV, "/nonexistent")
    with pytest.raises(translation.ModelUnavailable):
        translation.translate(["Hej."], "sv", "en")
    with pytest.raises(translation.ModelUnavailable):
        translation.translate(["Hej."], "sv", "de")


# --- the real model --------------------------------------------------------------------------------

MODELS_DIR = Path(os.environ.get(translation.MODELS_DIR_ENV, translation.DEFAULT_MODELS_DIR))


@pytest.mark.skipif(not (MODELS_DIR / "sv-en" / "model.bin").exists(), reason="the sv-en model is not converted on this machine")
def test_the_real_model_translates_and_keeps_the_glossary():
    out = translation.translate(["Lagfart och pantbrev är kostnader som många glömmer. Fråga mäklaren om stambytet."], "sv", "en")[0]
    assert "title registration (lagfart)" in out.lower()
    assert "pipe replacement" in out.lower()
    assert "estate agent" in out.lower()
    assert "lagfart och" not in out.lower()
