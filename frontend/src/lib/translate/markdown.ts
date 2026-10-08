import { parseMarkdown, type ContentBlock, type Inline } from "../content/markdown";

/**
 * Translating an article's Markdown without breaking its formatting.
 *
 * The article is taken apart the way the page does it (lib/content/markdown.ts): headings, paragraphs, list
 * items, "good to know" boxes. Each piece of text is sent to the translator on its own, so a heading stays a
 * heading and a list stays a list. Inside a piece, bold, italic and links are replaced by numbered markers
 * - "Läs [1]mer[/1] om [2]räntan[/2]" - which the translator moves with the words they belong to; afterwards the
 * markers become Markdown again. If the translator loses or scrambles a marker, the piece is written without
 * formatting rather than with it in the wrong place.
 */

export interface Span {
  kind: "strong" | "em" | "link";
  href?: string;
}

/** One piece of text of an article, ready to be translated, and what is needed to put it back. */
export interface Segment {
  /** What goes to the translator. */
  marked: string;
  spans: Span[];
}

export function inlineToMarked(nodes: Inline[]): Segment {
  const spans: Span[] = [];
  const walk = (list: Inline[]): string =>
    list
      .map((node) => {
        if (node.type === "text") return node.text;
        spans.push(node.type === "link" ? { kind: "link", href: node.href } : { kind: node.type });
        const id = spans.length;
        return `[${id}]${walk(node.children)}[/${id}]`;
      })
      .join("");
  const marked = walk(nodes);
  return { marked, spans };
}

const MARKER = /\[(\d+)\]|\[\/(\d+)\]/g;

/** The markers back to Markdown; plain text without markers when they do not add up. */
export function markedToMarkdown(translated: string, spans: Span[]): string {
  const plain = () => translated.replace(MARKER, "").replace(/ {2,}/g, " ");
  if (spans.length === 0) return plain();

  const opened = new Set<number>();
  const stack: number[] = [];
  let out = "";
  let last = 0;
  for (const match of translated.matchAll(MARKER)) {
    out += translated.slice(last, match.index);
    last = match.index + match[0].length;
    if (match[1] !== undefined) {
      const id = Number(match[1]);
      if (id < 1 || id > spans.length || opened.has(id)) return plain();
      opened.add(id);
      stack.push(id);
      const span = spans[id - 1];
      out += span.kind === "strong" ? "**" : span.kind === "em" ? "*" : "[";
    } else {
      const id = Number(match[2]);
      if (stack.pop() !== id) return plain();
      const span = spans[id - 1];
      out += span.kind === "strong" ? "**" : span.kind === "em" ? "*" : `](${span.href})`;
    }
  }
  out += translated.slice(last);
  if (stack.length > 0 || opened.size !== spans.length) return plain();
  return out;
}

/** The Markdown of one block as a line of text, to be translated as one piece. */
type Piece =
  | { block: "h2" | "h3"; segment: Segment }
  | { block: "p" | "note"; segment: Segment }
  | { block: "list"; ordered: boolean; segments: Segment[] };

/** The pieces of an article's body, in order. */
export function piecesOf(body: string): { blocks: ContentBlock[]; pieces: Piece[] } {
  const blocks = parseMarkdown(body);
  const pieces: Piece[] = blocks.map((block): Piece => {
    switch (block.type) {
      case "h2":
      case "h3":
        return { block: block.type, segment: { marked: block.text, spans: [] } };
      case "p":
      case "note":
        return { block: block.type, segment: inlineToMarked(block.inline) };
      case "list":
        return { block: "list", ordered: block.ordered, segments: block.items.map(inlineToMarked) };
    }
  });
  return { blocks, pieces };
}

/** The texts to send to the translator, in the order `assembleMarkdown` expects the answers. */
export function textsOf(pieces: Piece[]): string[] {
  return pieces.flatMap((piece) => (piece.block === "list" ? piece.segments.map((s) => s.marked) : [piece.segment.marked]));
}

/**
 * Writes the article again, with the translations in place. `translated` is in the order of `textsOf`; a null
 * (this piece could not be translated) keeps the piece in Swedish. `complete` is false when that happened.
 */
export function assembleMarkdown(pieces: Piece[], translated: (string | null)[]): { markdown: string; complete: boolean } {
  let next = 0;
  let complete = true;
  const text = (segment: Segment): string => {
    const answer = translated[next++];
    if (answer === null || answer === undefined) {
      complete = false;
      return markedToMarkdown(segment.marked, segment.spans);
    }
    return markedToMarkdown(answer, segment.spans);
  };

  const lines = pieces.map((piece) => {
    switch (piece.block) {
      case "h2":
        return `## ${text(piece.segment).replace(/\s+/g, " ").trim()}`;
      case "h3":
        return `### ${text(piece.segment).replace(/\s+/g, " ").trim()}`;
      case "p":
        return text(piece.segment).replace(/\s*\n\s*/g, " ").trim();
      case "note":
        return `> ${text(piece.segment).replace(/\s*\n\s*/g, " ").trim()}`;
      case "list":
        return piece.segments.map((segment, i) => `${piece.ordered ? `${i + 1}.` : "-"} ${text(segment).replace(/\s*\n\s*/g, " ").trim()}`).join("\n");
    }
  });
  return { markdown: lines.join("\n\n"), complete };
}

