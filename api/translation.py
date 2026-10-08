"""Offline machine translation of the site's own content (Swedish -> other languages).

Used by the Next.js app to show articles and map listings in the reader's language without anyone writing a
translation (frontend/src/lib/translate). Free and open source end to end:

  * the model is Opus-MT (Helsinki-NLP, University of Helsinki), converted to CTranslate2 (MIT) at image build
    time - see the Dockerfile; no API, no key, no per-character fee and nothing leaves this server;
  * sentencepiece (Apache-2.0) does the tokenising.

The model files live in TRANSLATION_MODELS_DIR (/models in the image), one folder per language pair
("sv-en"). A pair whose folder is missing is simply not available: the caller gets 503 and shows the Swedish text.

What this file adds around the raw model, because a general model does not know a home-buying site:
  * a glossary (translation_glossary.py): "lagfart", "pantbrev", "stambyte", "Trygghetspaketet" ... come out the
    same every time, and "Köpanalys" is never translated;
  * sentence splitting, so a long paragraph is translated sentence by sentence (the model is trained on
    sentences and drifts on long input);
  * numbers written the way the target language writes them (2 495 000 -> 2,495,000; 3,5 -> 3.5);
  * the markers the caller puts around formatting ("[1]bold words[/1]") pass through the model untouched.
"""

from __future__ import annotations

import logging
import os
import re
import threading
from dataclasses import dataclass
from pathlib import Path

from translation_glossary import GLOSSARY_VERSION, glossary_for

logger = logging.getLogger("kopanalys.translation")

MODELS_DIR_ENV = "TRANSLATION_MODELS_DIR"
DEFAULT_MODELS_DIR = "/models"

# (source, target) -> folder inside the models directory. Add a language by converting its model into a new
# folder (see the Dockerfile) and adding a line here and a glossary in translation_glossary.py.
MODEL_FOLDERS: dict[tuple[str, str], str] = {("sv", "en"): "sv-en"}

# Bumped when the way text is translated changes in a way that changes the output (the model, the glossary,
# the number rules). The Next.js app stores translations under this version, so improving the translator
# makes new translations of everything, instead of serving old ones forever.
ENGINE_VERSION = f"opus-mt-sv-en-1+g{GLOSSARY_VERSION}"

MAX_TOKENS_PER_SENTENCE = 400
BEAM_SIZE = 4
BATCH_TOKENS = 2048

# ---------------------------------------------------------------------------------------------------
# Splitting text into sentences
# ---------------------------------------------------------------------------------------------------

# Swedish abbreviations that end in a full stop but do not end a sentence.
_ABBREVIATIONS = (
    "t.ex", "bl.a", "m.m", "m.fl", "dvs", "s.k", "ca", "kr", "nr", "fr.o.m", "t.o.m", "kl", "jfr", "resp",
    "osv", "ev", "inkl", "exkl", "pga", "enl", "tel", "st", "mkr", "mfl", "ung", "mars", "f.d", "o.d", "p.g.a",
)
_ABBREVIATION_END = re.compile(r"(?:^|[\s(\[])(?:" + "|".join(re.escape(a) for a in _ABBREVIATIONS) + r")\.$", re.IGNORECASE)
_SENTENCE_END = re.compile(r"([.!?]+[\"”’)\]]*)\s+(?=[\"“‘(\[]?[A-ZÅÄÖÉ0-9])")


def split_sentences(line: str) -> list[str]:
    """Splits one line of text into sentences. Never splits inside a [marker]...[/marker] span or after an
    abbreviation ("t.ex. så här"). Joined with single spaces the pieces give the line back."""
    pieces: list[str] = []
    start = 0
    for match in _SENTENCE_END.finditer(line):
        head = line[start : match.end(1)]
        if _ABBREVIATION_END.search(head):
            continue
        # inside a marker span ([1] ... [/1]) the opening markers outnumber the closing ones
        if len(re.findall(r"\[(?!/)\w+\]", head)) > len(re.findall(r"\[/\w+\]", head)):
            continue
        pieces.append(head.strip())
        start = match.end()
    tail = line[start:].strip()
    if tail:
        pieces.append(tail)
    return pieces or ([line.strip()] if line.strip() else [])


# ---------------------------------------------------------------------------------------------------
# Numbers
# ---------------------------------------------------------------------------------------------------

SPACES = "\u00a0\u202f "  # a space, a no-break space, a narrow no-break space: how Swedish groups thousands
_THOUSANDS = re.compile(rf"(?<![\d.,])(\d{{1,3}})((?:[{SPACES}]\d{{3}})+)(?!\d)")
_DECIMAL_COMMA = re.compile(r"(?<=\d),(?=\d)")


def localize_numbers(text: str, target: str) -> str:
    """Swedish number formats -> the target language's, before the text goes into the model (the model copies digits)."""
    if target != "en":
        return text
    # the decimal comma first: the commas the thousands get below must not be taken for decimal commas
    text = _DECIMAL_COMMA.sub(".", text)
    return _THOUSANDS.sub(lambda m: m.group(1) + re.sub(f"[{SPACES}]", ",", m.group(2)), text)


def tidy_currency(text: str, target: str) -> str:
    """'499 SEK' -> 'SEK 499' (how the English pages of the site write prices), and the model's '55 m2' -> '55 m²'."""
    if target != "en":
        return text
    text = re.sub(r"(?<=\d)\s?m2\b", " m²", text)
    return re.sub(r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)\s*(?:SEK|kr|kronor)\b", r"SEK \1", text)


# ---------------------------------------------------------------------------------------------------
# The glossary: protect terms on the way in, put them back on the way out
# ---------------------------------------------------------------------------------------------------

_GLOSSARY_MARK = re.compile(r"\[g(\d+)\](.*?)\[/g\1\]", re.DOTALL)


@dataclass
class Protected:
    text: str
    replacements: dict[int, str]


def _match_case(source: str, english: str) -> str:
    """The English term starts with a capital letter when the Swedish word did ("Lagfart" -> "Title registration")."""
    if source[:1].isupper() and english[:1].islower() and not source.isupper():
        return english[:1].upper() + english[1:]
    return english


def protect_terms(text: str, target: str) -> Protected:
    """Wraps every glossary term in [gN]...[/gN]; the model passes such a span through, and restore_terms()
    puts the glossary's own translation in its place."""
    entries = glossary_for(target)
    replacements: dict[int, str] = {}
    if not entries:
        return Protected(text, replacements)

    # One pass over the text with every term as an alternative (in the glossary's order, longest forms first),
    # so a term can never be wrapped twice or inside another.
    combined = re.compile(
        r"(?<![\w\[])(?:" + "|".join(f"(?P<t{i}>{pattern})" for i, (pattern, _) in enumerate(entries)) + r")(?![\w\]])",
        re.IGNORECASE,
    )

    def wrap(match: re.Match[str]) -> str:
        which = next(int(name[1:]) for name, value in match.groupdict().items() if value is not None and name.startswith("t"))
        pattern, english = entries[which]
        if callable(english):
            # a pattern with a group of its own ("(\d):a"): match it again on its own to read the group
            inner = re.fullmatch(pattern, match.group(0), re.IGNORECASE)
            english = english(inner) if inner else match.group(0)
        index = len(replacements) + 1
        replacements[index] = _match_case(match.group(0), english)
        return f"[g{index}]{match.group(0)}[/g{index}]"

    return Protected(combined.sub(wrap, text), replacements)


def restore_terms(text: str, replacements: dict[int, str]) -> str:
    def put_back(match: re.Match[str]) -> str:
        return replacements.get(int(match.group(1)), match.group(2))

    text = _GLOSSARY_MARK.sub(put_back, text)
    # a marker the model lost half of: drop what is left of it
    return re.sub(r"\[/?g\d+\]", "", text)


# ---------------------------------------------------------------------------------------------------
# The model
# ---------------------------------------------------------------------------------------------------


class ModelUnavailable(Exception):
    """The model for this language pair is not installed on this server."""


class _Model:
    def __init__(self, folder: Path):
        import ctranslate2
        import sentencepiece as spm

        threads = int(os.environ.get("TRANSLATION_THREADS", "0")) or max(1, (os.cpu_count() or 2))
        self.translator = ctranslate2.Translator(str(folder), device="cpu", compute_type="int8", inter_threads=1, intra_threads=threads)
        self.source = spm.SentencePieceProcessor(str(folder / "source.spm"))
        self.target = spm.SentencePieceProcessor(str(folder / "target.spm"))

    def translate_batch(self, sentences: list[str]) -> list[str]:
        # Marian models need the end-of-sentence token on the source, or they keep going and repeat themselves.
        tokens = [self.source.encode(s, out_type=str)[:MAX_TOKENS_PER_SENTENCE] + ["</s>"] for s in sentences]
        results = self.translator.translate_batch(
            tokens,
            beam_size=BEAM_SIZE,
            max_input_length=MAX_TOKENS_PER_SENTENCE + 1,
            max_decoding_length=MAX_TOKENS_PER_SENTENCE * 2,
            max_batch_size=BATCH_TOKENS,
            batch_type="tokens",
        )
        return [self.target.decode(r.hypotheses[0]) for r in results]


_models: dict[tuple[str, str], _Model] = {}
_load_lock = threading.Lock()
# One translation at a time: the model uses every core, and this process also serves the other endpoints.
_run_lock = threading.Lock()


def _model_for(source: str, target: str) -> _Model:
    key = (source, target)
    folder_name = MODEL_FOLDERS.get(key)
    if folder_name is None:
        raise ModelUnavailable(f"No translation from {source} to {target}.")
    if key not in _models:
        with _load_lock:
            if key not in _models:
                folder = Path(os.environ.get(MODELS_DIR_ENV, DEFAULT_MODELS_DIR)) / folder_name
                if not (folder / "model.bin").exists():
                    raise ModelUnavailable(f"The {source}-{target} model is not installed ({folder}).")
                logger.info("Loading the %s-%s translation model from %s", source, target, folder)
                _models[key] = _Model(folder)
    return _models[key]


def is_available(source: str, target: str) -> bool:
    try:
        _model_for(source, target)
        return True
    except ModelUnavailable:
        return False


_WHITESPACE_EDGES = re.compile(r"^(\s*)(.*?)(\s*)$", re.DOTALL)


def translate(texts: list[str], source: str, target: str, translate_sentences=None) -> list[str]:
    """Translates every text, keeping its line breaks and the whitespace around it.

    `translate_sentences` is a stand-in for the model, for tests: it takes a list of sentences and returns the
    same number of translated sentences.
    """
    if translate_sentences is None:
        model = _model_for(source, target)
        translate_sentences = model.translate_batch

    # 1. every text -> lines -> sentences, remembered by position
    layouts: list[tuple[str, str, list[list[int]]]] = []  # (leading, trailing, per line: sentence indexes)
    sentences: list[str] = []
    protected: list[Protected] = []
    for text in texts:
        lead, body, trail = _WHITESPACE_EDGES.match(text).groups()  # type: ignore[union-attr]
        lines: list[list[int]] = []
        for line in body.split("\n"):
            indexes: list[int] = []
            for sentence in split_sentences(line):
                guarded = protect_terms(localize_numbers(sentence, target), target)
                indexes.append(len(sentences))
                sentences.append(guarded.text)
                protected.append(guarded)
            lines.append(indexes)
        layouts.append((lead, trail, lines))

    # 2. translate, longest first so batches hold similar lengths
    order = sorted(range(len(sentences)), key=lambda i: len(sentences[i]), reverse=True)
    translated = [""] * len(sentences)
    with _run_lock:
        for start in range(0, len(order), 32):
            chunk = order[start : start + 32]
            for position, result in zip(chunk, translate_sentences([sentences[i] for i in chunk])):
                translated[position] = result

    # 3. put the glossary's words back, and the text together again
    finished = [tidy_currency(restore_terms(t, p.replacements), target).strip() for t, p in zip(translated, protected)]
    out: list[str] = []
    for lead, trail, lines in layouts:
        out.append(lead + "\n".join(" ".join(finished[i] for i in indexes) for indexes in lines) + trail)
    return out
