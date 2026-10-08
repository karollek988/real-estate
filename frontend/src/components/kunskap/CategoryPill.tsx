import { findCategory, type ContentCategorySlug } from "@/lib/content/model";
import { TONE_CLASSES } from "./categoryStyle";
import { useKunskap } from "./useKunskap";

/** A guide's subject as a small coloured label ("BRF & EKONOMI"). Renders nothing without a category. */
export function CategoryPill({ category, className = "" }: { category: ContentCategorySlug | null; className?: string }) {
  const { categoryLabel } = useKunskap();
  const found = findCategory(category);
  if (!found) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.07em] ${TONE_CLASSES[found.tone].pill} ${className}`}
    >
      {categoryLabel(found.slug)}
    </span>
  );
}

/** Marks temporary development content (lib/content/demo.ts) so nobody mistakes it for a real guide. */
export function DemoBadge({ className = "" }: { className?: string }) {
  const { t } = useKunskap();
  return (
    <span
      title={t("demo.hint")}
      className={`inline-flex items-center rounded-full border border-dashed border-ka-amber-700/50 bg-ka-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ka-amber-700 ${className}`}
    >
      {t("demo.badge")}
    </span>
  );
}
