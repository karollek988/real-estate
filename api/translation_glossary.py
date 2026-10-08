"""Words the translator must get right, whatever the model thinks.

A general translation model does not know that "lagfart" is title registration, that "stambyte" is replacing the
pipes of a building or that "Köpanalys" is a name. Every entry here is (a pattern for the Swedish word in all its
forms, the English text to use). The translator protects a matching word before the model sees it and writes the
English text in its place afterwards (translation.py).

How to add a term: add a line to the list of the target language. The pattern is a regular expression, matched
whole-word and ignoring case; put the longer forms first ("bostadsrättsföreningen" before "bostadsrättsförening"),
and write the plural and the definite form as their own lines so that "the" comes out right. The English text
starts with a lower-case letter; a Swedish word that starts with a capital gets a capital in English too.
Raise GLOSSARY_VERSION when you change this file: translations are stored under it, and a new version
makes the site translate everything again with the new words.

The English terms follow src/i18n/messages/en/index.ts (the site's own glossary) - keep the two in step.
"""

from __future__ import annotations

import re
from typing import Callable

GLOSSARY_VERSION = 3

# The English text, or a function that makes it from the match (for "3:a" -> "3-room flat").
Replacement = str | Callable[[re.Match[str]], str]


def _rooms(match: re.Match[str]) -> str:
    return f"{match.group(1)}-room flat"


_EN: list[tuple[str, Replacement]] = [
    # --- the brand and the products: never translated, or translated the way the site itself writes them
    (r"Köpanalysens?", "Köpanalys"),
    (r"Köpanalys", "Köpanalys"),
    (r"Trygghetspaketet", "the Peace of Mind Package"),
    (r"Trygghetspaket(?:en|s)?", "Peace of Mind Package"),
    (r"Områdesanalysen", "the Area analysis"),
    (r"Områdesanalys(?:er|erna)?", "Area analysis"),
    (r"Bostadsguiden", "the Housing guide"),
    (r"Boendekalkylen", "the housing cost calculation"),
    (r"Boendekalkyl", "housing cost calculation"),
    (r"Visningsguiden", "the Viewing guide"),
    # --- housing associations and tenant-owned flats
    (r"bostadsrättsföreningens", "the housing association's"),
    (r"bostadsrättsföreningen", "the housing association"),
    (r"bostadsrättsföreningarna", "the housing associations"),
    (r"bostadsrättsföreningar", "housing associations"),
    (r"bostadsrättsförening", "housing association"),
    (r"bostadsrätterna", "the tenant-owned flats"),
    (r"bostadsrätter", "tenant-owned flats"),
    (r"bostadsrätten", "the tenant-owned flat"),
    (r"bostadsrätt", "tenant-owned flat"),
    (r"hyresrätterna", "the rental flats"),
    (r"hyresrätter", "rental flats"),
    (r"hyresrätten", "the rental flat"),
    (r"hyresrätt", "rental flat"),
    (r"föreningens", "the association's"),
    (r"föreningarna", "the associations"),
    (r"föreningen", "the association"),
    (r"föreningar", "associations"),
    (r"årsredovisningarna", "the annual reports"),
    (r"årsredovisningar", "annual reports"),
    (r"årsredovisningen", "the annual report"),
    (r"årsredovisning", "annual report"),
    (r"underhållsplanen", "the maintenance plan"),
    (r"underhållsplan", "maintenance plan"),
    (r"räntekänsligheten", "the interest rate sensitivity"),
    (r"räntekänslighet", "interest rate sensitivity"),
    (r"soliditeten", "the equity ratio"),
    (r"soliditet", "equity ratio"),
    (r"tomträtten", "the leasehold (tomträtt)"),
    (r"tomträtt", "leasehold (tomträtt)"),
    (r"tomträttsavgälden", "the leasehold fee (tomträttsavgäld)"),
    (r"tomträttsavgäld", "leasehold fee (tomträttsavgäld)"),
    (r"andelstalet", "the share ratio (andelstal)"),
    (r"andelstal", "share ratio (andelstal)"),
    (r"stambytet", "the pipe replacement"),
    (r"stambyten", "pipe replacements"),
    (r"stambyte", "pipe replacement"),
    # --- buying a home
    (r"lagfarten", "the title registration (lagfart)"),
    (r"lagfart", "title registration (lagfart)"),
    (r"pantbreven", "the mortgage deeds"),
    (r"pantbrevet", "the mortgage deed"),
    (r"ett pantbrev", "a mortgage deed"),
    (r"pantbrev", "mortgage deeds"),
    (r"kontantinsatsen", "the deposit"),
    (r"kontantinsats", "deposit"),
    (r"budgivningen", "the bidding"),
    (r"budgivning", "bidding"),
    (r"visningarna", "the viewings"),
    (r"visningar", "viewings"),
    (r"visningen", "the viewing"),
    (r"visning", "viewing"),
    (r"mäklarens", "the estate agent's"),
    (r"mäklaren", "the estate agent"),
    (r"mäklare", "estate agent"),
    (r"månadsavgiften", "the monthly fee"),
    (r"månadsavgift", "monthly fee"),
    (r"besiktningen", "the survey"),
    (r"besiktning", "survey"),
    (r"slutbesiktning", "final inspection"),
    (r"skuldsättningen", "the debt level"),
    (r"skuldsättning", "debt level"),
    (r"nyproduktion", "new build"),
    (r"nyproducerad(?:e)?", "newly built"),
    # --- the kinds of home and the words of a listing
    (r"(\d):a(?:n)?", _rooms),
    (r"tvåan", "the 2-room flat"),
    (r"tvåa", "2-room flat"),
    (r"trean", "the 3-room flat"),
    (r"trea", "3-room flat"),
    (r"radhus(?:et)?", "terraced house"),
    (r"parhus(?:et)?", "semi-detached house"),
    (r"kedjehus(?:et)?", "linked house"),
    (r"fritidshus(?:et)?", "holiday home"),
    (r"sekelskifteslägenhet(?:en)?", "turn-of-the-century flat"),
    (r"hiss(?:en)?", "lift"),
    (r"tomten", "the plot"),
    (r"tomt", "plot"),
]

_GLOSSARIES: dict[str, list[tuple[str, Replacement]]] = {"en": _EN}


def glossary_for(target: str) -> list[tuple[str, Replacement]]:
    return _GLOSSARIES.get(target, [])
