import { CoinsIcon, FileTextIcon, HouseIcon, MapPinIcon, ShieldIcon } from "@/components/icons";
import type { NavIcon } from "@/components/site/navigation";
import type { CategoryTone, ContentCategorySlug } from "@/lib/content/model";

/** Each Bostadsguiden subject's icon. */
export const CATEGORY_ICONS: Record<ContentCategorySlug, NavIcon> = {
  "kopa-bostad": HouseIcon,
  "brf-ekonomi": CoinsIcon,
  omraden: MapPinIcon,
  risker: ShieldIcon,
  kostnader: FileTextIcon,
};

/**
 * A category's colour in its two places (tokens in styles/_variables.scss):
 *  pill  - the label on a card or an article (text >= 5.8:1 on its background)
 *  onDark - the icon in the deep green category band
 */
export const TONE_CLASSES: Record<CategoryTone, { pill: string; onDark: string }> = {
  green: { pill: "bg-ka-sage text-ka-green-900", onDark: "text-ka-mint" },
  amber: { pill: "bg-ka-amber-100 text-ka-amber-700", onDark: "text-ka-amber-300" },
  sky: { pill: "bg-ka-sky-100 text-ka-sky-700", onDark: "text-ka-sky-300" },
  coral: { pill: "bg-ka-coral-100 text-ka-coral-700", onDark: "text-ka-coral-300" },
  stone: { pill: "bg-ka-stone text-ka-text", onDark: "text-ka-sand" },
};
