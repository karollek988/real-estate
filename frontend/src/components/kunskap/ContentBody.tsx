import { Fragment } from "react";
import { Link, type Href } from "@/i18n/navigation";
import { CheckIcon, LightbulbIcon } from "@/components/icons";
import { resolveInternal } from "@/i18n/path";
import type { ContentBlock, Inline } from "@/lib/content/markdown";

/**
 * The body of a guide, insight or news item, from the blocks markdown.ts
 * parses: React elements only, never raw HTML. Links inside the site go
 * through the language-aware Link (a link to "/priser" lands on /en/pricing for an
 * English reader); links elsewhere open in a new tab.
 */
export function ContentBody({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 id={block.id} className="scroll-mt-28 pt-6 font-display text-[27px] font-bold leading-[1.15] tracking-[-0.015em] text-ka-ink sm:text-[32px]">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 id={block.id} className="scroll-mt-28 pt-2 text-[20px] font-bold leading-snug text-ka-ink sm:text-[21px]">
          {block.text}
        </h3>
      );
    case "p":
      return (
        <p className="text-[17.5px] leading-[1.75] text-ka-text">
          <Inlines nodes={block.inline} />
        </p>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3.5 text-[17px] leading-[1.65] text-ka-text">
              {block.ordered ? (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ka-green-900 text-[13px] font-bold text-white">
                  {i + 1}
                </span>
              ) : (
                <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ka-sage text-ka-green-900">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.6} />
                </span>
              )}
              <span className="min-w-0">
                <Inlines nodes={item} />
              </span>
            </li>
          ))}
        </List>
      );
    }
    case "note":
      return (
        <aside className="flex gap-4 rounded-[20px] border border-ka-green-700/20 bg-ka-sage/45 p-5 sm:p-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ka-green-800 ring-1 ring-ka-green-700/15">
            <LightbulbIcon className="h-5 w-5" />
          </span>
          <p className="text-[16.5px] leading-[1.7] text-ka-text">
            <Inlines nodes={block.inline} />
          </p>
        </aside>
      );
  }
}

const LINK = "font-semibold text-ka-green-700 underline decoration-ka-green-700/35 underline-offset-[3px] transition hover:text-ka-green-900 hover:decoration-ka-green-900";

/** The page of the site that an address like "/priser#vad-kostar-det?x=1" points at, as the language-aware Link takes it; null for any other address. */
function siteHref(href: string): Href | null {
  if (!href.startsWith("/")) return null;
  const [beforeHash, hash] = href.split("#");
  const [path, queryString] = beforeHash.split("?");
  const page = resolveInternal(path);
  if (!page) return null;
  const query = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : undefined;
  return {
    pathname: page.pathname,
    ...(Object.keys(page.params).length > 0 ? { params: page.params } : {}),
    ...(query ? { query } : {}),
    ...(hash ? { hash } : {}),
  } as Href;
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case "text":
            return <Fragment key={i}>{node.text}</Fragment>;
          case "strong":
            return (
              <strong key={i} className="font-semibold text-ka-ink">
                <Inlines nodes={node.children} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <Inlines nodes={node.children} />
              </em>
            );
          case "link": {
            const internal = siteHref(node.href);
            if (internal) {
              return (
                <Link key={i} href={internal} className={LINK}>
                  <Inlines nodes={node.children} />
                </Link>
              );
            }
            // an anchor on the same page (#avsnitt) stays a plain link
            return node.href.startsWith("#") || node.href.startsWith("/") ? (
              <a key={i} href={node.href} className={LINK}>
                <Inlines nodes={node.children} />
              </a>
            ) : (
              <a key={i} href={node.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                <Inlines nodes={node.children} />
              </a>
            );
          }
        }
      })}
    </>
  );
}
