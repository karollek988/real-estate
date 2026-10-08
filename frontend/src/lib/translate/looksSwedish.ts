/**
 * A cheap guess whether a text is written in Swedish, for texts a visitor wrote themselves (a map listing): the
 * translator only knows Swedish -> other languages, and a text that is already English should be left alone
 * rather than sent through it. Letters å, ä, ö, or a good share of everyday Swedish words, count as Swedish.
 * Wrong in either direction is harmless: an English text sent through the translator comes back nearly unchanged,
 * and a Swedish text that is not recognised is simply shown as written.
 */
const SWEDISH_WORDS = new Set(
  (
    "och att det som är för med på av till inte har den ett jag vi du kan om från eller också mycket nära söker erbjuder " +
    "lägenhet bostad hus rum kvm balkong tomt hiss centrum månadsavgift avgift renoverad nyrenoverad stort stor liten fin " +
    "ljus gärna familj barn budget upp till salu köpare säljer vill bo byta byter bytes söka tillträde"
  ).split(" "),
);

export function looksSwedish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-zåäö]+/g) ?? [];
  if (words.length === 0) return false;
  // one or two words with an å, ä or ö are most likely a name ("Södermalm"), which is not translated
  if (/[åäöÅÄÖ]/.test(text) && words.length >= 3) return true;
  const hits = words.filter((word) => SWEDISH_WORDS.has(word)).length;
  return hits >= 2 || (hits >= 1 && hits / words.length >= 0.25);
}
