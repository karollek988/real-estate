// Standalone verification for the parts of lib/translate that do not need the translator: taking an article's
// Markdown apart into texts to translate and putting it back together, and the guess whether a text is Swedish.
// No test framework in this project (see the other *.verify.mjs). Run with:
//   npx tsx src/lib/translate/translate.verify.mjs
import { assembleMarkdown, inlineToMarked, markedToMarkdown, piecesOf, textsOf } from "./markdown.ts";
import { looksSwedish } from "./looksSwedish.ts";
import { parseInline, parseMarkdown } from "../content/markdown.ts";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}`);
  if (!pass) {
    failures++;
    console.log("  expected:", JSON.stringify(expected));
    console.log("  actual:  ", JSON.stringify(actual));
  }
}

const ARTICLE = `Det här är **viktigt** och *betonat*, med en [länk](/bostadsguider/annan-guide) i mitten.

## Ett avsnitt

- Första **punkten**
- Andra punkten med [extern länk](https://example.com/x)

1. Steg ett
2. Steg två

> **Bra att veta:** en ruta.

### En underrubrik

Sista stycket.`;

// ── inline formatting <-> markers ────────────────────────────────────────────
{
  const { marked, spans } = inlineToMarked(parseInline("Läs **mer** om [räntan](/priser) nu"));
  check("formatting becomes numbered markers", marked, "Läs [1]mer[/1] om [2]räntan[/2] nu");
  check("what each marker was is remembered", spans, [{ kind: "strong" }, { kind: "link", href: "/priser" }]);
  check("markers become Markdown again", markedToMarkdown("Read [1]more[/1] about [2]the rate[/2] now", spans), "Read **more** about [the rate](/priser) now");
  check("the markers may move with the words", markedToMarkdown("[2]The rate[/2]: read [1]more[/1]", spans), "[The rate](/priser): read **more**");
}
{
  const { spans } = inlineToMarked(parseInline("En **fet** och *kursiv* text"));
  check("a lost closing marker gives plain text, not broken formatting", markedToMarkdown("A [1]bold and [2]italic[/2] text", spans), "A bold and italic text");
  check("markers in the wrong order give plain text", markedToMarkdown("A [1]bold [2]and[/1] italic[/2] text", spans), "A bold and italic text");
  check("a marker the translator invented gives plain text", markedToMarkdown("A [1]bold[/1] and [2]italic[/2] and [3]more[/3]", spans), "A bold and italic and more");
  check("a marker that was dropped gives plain text", markedToMarkdown("A [1]bold[/1] and italic", spans), "A bold and italic");
  check("text without any markers is left alone", markedToMarkdown("Just text.", []), "Just text.");
}

// ── a whole article ──────────────────────────────────────────────────────────
{
  const { pieces } = piecesOf(ARTICLE);
  const texts = textsOf(pieces);
  check("one text for each paragraph, heading and list item", texts.length, 9);
  check("headings are plain text", texts[1], "Ett avsnitt");

  // with no translation at all the article comes back as the same blocks
  const same = assembleMarkdown(pieces, texts);
  check("an unchanged article has the same blocks", parseMarkdown(same.markdown), parseMarkdown(ARTICLE));
  check("and counts as complete", same.complete, true);

  // a "translation" that keeps the markers: the structure and the links survive
  const shouted = assembleMarkdown(
    pieces,
    texts.map((t) => t.replace(/[^[\]/\d\s]+/g, (w) => w.toUpperCase())),
  );
  const blocks = parseMarkdown(shouted.markdown);
  check("the block kinds survive", blocks.map((b) => b.type), ["p", "h2", "list", "list", "note", "h3", "p"]);
  const link = JSON.stringify(blocks[0]).includes('"href":"/bostadsguider/annan-guide"');
  check("a link keeps its address", link, true);
  check("a list keeps its items", blocks[2].items.length, 2);
  check("an ordered list stays ordered", blocks[3].ordered, true);

  // a piece that could not be translated stays in Swedish, the rest is translated
  const partial = assembleMarkdown(pieces, texts.map((t, i) => (i === 0 ? null : t.toUpperCase())));
  check("an untranslated piece is reported", partial.complete, false);
  check("and kept as it was written", partial.markdown.startsWith("Det här är **viktigt**"), true);
}

// ── is it Swedish? ───────────────────────────────────────────────────────────
check("a Swedish sentence", looksSwedish("Ljus tvåa med balkong och låg månadsavgift."), true);
check("a Swedish title with å/ä/ö", looksSwedish("Fin lägenhet nära centrum"), true);
check("an English sentence", looksSwedish("Bright two-room flat with a balcony and a low monthly fee."), false);
check("a place name is not translated", looksSwedish("Södermalm"), false);
check("two words with an umlaut are a name", looksSwedish("Östermalm Stockholm"), false);
check("a measurement line with a Swedish word", looksSwedish("2 rum · 55 m²"), true);
check("nothing", looksSwedish("  "), false);

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll translation checks passed.");
