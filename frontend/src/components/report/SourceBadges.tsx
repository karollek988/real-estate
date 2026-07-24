/** Small badge pills for the "Källor" line every chapter ends with —
 *  the same source names ChapterSources always listed, just read as
 *  provenance tags instead of a bullet list. */
export function SourceBadges({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <p className="mt-2 text-[12.5px] italic text-[#8C8471]">Inga anslutna källor användes i det här kapitlet ännu.</p>;
  }
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {names.map((name) => (
        <span
          key={name}
          className="rounded-full border border-black/[0.08] bg-white/70 px-3 py-1 text-[11px] font-medium text-[#5B5648]"
        >
          {name}
        </span>
      ))}
    </div>
  );
}
