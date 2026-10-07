import { GraduationCapIcon, ShieldIcon, ShoppingBagIcon, TrainIcon, TrendingUpIcon } from "@/components/icons";

/**
 * What an Områdesanalys covers - the area chapter of the report (app/report
 * AreaChapter), worded as in the FAQ. Shown on the landing page's "Områden"
 * and on /omraden. A plain module (not "use client") so server pages can use
 * the list as data. The words are in the messages: sections.areas.topics.<id>.title / .text
 */
export const AREA_TOPICS = [
  { icon: ShoppingBagIcon, id: "services" },
  { icon: GraduationCapIcon, id: "schools" },
  { icon: TrainIcon, id: "commuting" },
  { icon: ShieldIcon, id: "safety" },
  { icon: TrendingUpIcon, id: "development" },
] as const;
