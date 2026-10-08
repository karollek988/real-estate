import { useTranslations } from "next-intl";
import { Link, type Href } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/components/icons";
import { KUNSKAP_MENU, hrefKey } from "@/components/site/navigation";

/** The other two Kunskap hubs, as two link cards: keeps Bostadsguiden, Insikter and Nyheter one connected section. The words: nav.menus.kunskap, kunskap.moreInKnowledge */
export function KunskapLinks({ current }: { current: Href }) {
  const t = useTranslations("nav");
  const tKunskap = useTranslations("kunskap");
  const others = KUNSKAP_MENU.filter((item) => item.href !== current);
  return (
    <nav aria-label={tKunskap("moreInKnowledge")}>
      <ul className="grid gap-4 md:grid-cols-2">
        {others.map(({ key, href, icon: Icon }) => (
          <li key={hrefKey(href)}>
            <Link
              href={href}
              className="group flex h-full items-center gap-4 rounded-[22px] border border-ka-line-strong bg-white p-5 shadow-ka-card transition duration-300 hover:-translate-y-0.5 hover:border-ka-green-700/40 hover:shadow-ka-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-ka-cream motion-reduce:hover:translate-y-0 sm:p-6"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ka-green-900 text-white">
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17.5px] font-bold text-ka-ink">{t(`${key}.label`)}</span>
                <span className="mt-0.5 block text-[14.5px] text-ka-muted">{t(`${key}.description`)}</span>
              </span>
              <ArrowRightIcon className="h-5 w-5 shrink-0 text-ka-green-700 transition-transform group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
