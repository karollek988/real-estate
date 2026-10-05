import { GraduationCapIcon, ShieldIcon, ShoppingBagIcon, TrainIcon, TrendingUpIcon } from "@/components/icons";

/**
 * What an Områdesanalys covers - the area chapter of the report (app/report
 * AreaChapter), worded as in lib/faq.ts. Shown on the landing page's
 * "Områden" and on /omraden. A plain module (not "use client") so server
 * pages can use the list as data.
 */
export const AREA_TOPICS = [
  { icon: ShoppingBagIcon, title: "Service inom 1 km", text: "Matbutiker, restauranger, parker och vård nära bostaden." },
  { icon: GraduationCapIcon, title: "Skolor i närområdet", text: "Skolorna runt adressen, från Skolverkets register." },
  { icon: TrainIcon, title: "Pendling", text: "Restid till centrum med bil och kollektivtrafik." },
  { icon: ShieldIcon, title: "Trygghet och samhälle", text: "Statistik om trygghet och samhällsdata för kommunen." },
  { icon: TrendingUpIcon, title: "Hur området utvecklas", text: "Hur befolkning och priser i området utvecklas." },
];
