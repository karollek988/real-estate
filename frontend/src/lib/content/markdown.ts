/**
 * The Markdown the content editor accepts - a deliberately small subset, turned
 * into blocks that components/kunskap/ContentBody.tsx renders as React
 * elements. No HTML is ever passed through, so text from the editor cannot
 * inject markup or script.
 *
 *   ## Rubrik             section heading (h2, appears in the table of contents)
 *   ### Underrubrik       sub-heading (h3)
 *   - punkt / * punkt     bulleted list
 *   1. steg               numbered list
 *   > text                "Bra att veta" box (several > lines join into one)
 *   tom rad               new paragraph
 *   **fet**, *kursiv*, [länktext](/bostadsguider/annan-guide)
 *
 * Links must be relative to the site ("/..."), an anchor ("#...") or
 * http(s)/mailto - anything else (javascript:, data:) stays plain text.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] };

export type ContentBlock =
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; id: string; text: string }
  | { type: "p"; inline: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "note"; inline: Inline[] };

const SAFE_HREF = /^(?:\/(?!\/)|#|https?:\/\/|mailto:)/i;

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href) && !/[\s<>"']/.test(href);
}

// Earliest match wins; links before emphasis so "[**a**](/x)" stays a link.
// Emphasis needs text right inside its stars, so "2 * 3 * 4" stays arithmetic.
const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*|(?<!\*)\*(?![\s*])([^*\n]+?)(?<!\s)\*(?!\*)/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (match.index > 0) out.push({ type: "text", text: rest.slice(0, match.index) });
    const [whole, linkText, href, strong, em] = match;
    if (linkText !== undefined) {
      out.push(isSafeHref(href) ? { type: "link", href, children: parseInline(linkText) } : { type: "text", text: linkText });
    } else if (strong !== undefined) {
      out.push({ type: "strong", children: parseInline(strong) });
    } else {
      out.push({ type: "em", children: parseInline(em) });
    }
    rest = rest.slice(match.index + whole.length);
  }
  // Join neighbouring text pieces.
  return out.reduce<Inline[]>((acc, node) => {
    const last = acc[acc.length - 1];
    if (node.type === "text" && last?.type === "text") last.text += node.text;
    else acc.push(node);
    return acc;
  }, []);
}

/** Plain text of inline nodes (headings, the table of contents, structured data). */
export function inlineText(nodes: Inline[]): string {
  return nodes.map((node) => (node.type === "text" ? node.text : inlineText(node.children))).join("");
}

function headingId(text: string, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "avsnitt";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseMarkdown(markdown: string): ContentBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ContentBlock[] = [];
  const ids = new Set<string>();
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    if (text) blocks.push({ type: "p", inline: parseInline(text) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank lines and dividers (---) end a paragraph and show nothing themselves.
    if (!trimmed || /^(?:-{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      continue;
    }

    const heading = /^(#{2,3})\s+(.+?)\s*#*$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      const text = inlineText(parseInline(heading[2]));
      blocks.push({ type: heading[1].length === 2 ? "h2" : "h3", id: headingId(text, ids), text });
      continue;
    }
    // A single "#" would be a second page title; the page already has its H1.
    if (/^#\s+/.test(trimmed)) {
      flushParagraph();
      const text = inlineText(parseInline(trimmed.replace(/^#\s+/, "")));
      blocks.push({ type: "h2", id: headingId(text, ids), text });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      const quoted: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoted.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      const text = quoted.join(" ").trim();
      if (text) blocks.push({ type: "note", inline: parseInline(text) });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const item = pattern.exec(lines[i]);
        if (item) {
          items.push(parseInline(item[1].trim()));
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length > 0) {
          // An indented line continues the item above it.
          const last = items[items.length - 1];
          last.push({ type: "text", text: " " }, ...parseInline(lines[i].trim()));
        } else {
          break;
        }
        i++;
      }
      i--;
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks;
}

/** The h2 headings, for the article's table of contents. */
export function tableOfContents(blocks: ContentBlock[]): { id: string; text: string }[] {
  return blocks.flatMap((block) => (block.type === "h2" ? [{ id: block.id, text: block.text }] : []));
}
