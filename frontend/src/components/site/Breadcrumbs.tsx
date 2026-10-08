import { getTranslations } from "next-intl/server";
import { ChevronRightIcon } from "@/components/icons";
import { ROUTES } from "@/components/site/navigation";
import { Link, type Href } from "@/i18n/navigation";

export interface Crumb {
  label: string;
  href?: Href;
}

/** "Start › Kunskap › Bostadsguiden": the trail after Start; the last crumb is the current page. The words: common.breadcrumbs */
export async function Breadcrumbs({ crumbs, className = "" }: { crumbs: Crumb[]; className?: string }) {
  const t = await getTranslations("common.breadcrumbs");
  return (
    <nav aria-label={t("label")} className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-ka-muted">
        <li>
          <Link href={ROUTES.home} className="transition hover:text-ka-green-800 hover:underline">
            {t("home")}
          </Link>
        </li>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-ka-muted/70" strokeWidth={2} />
              {crumb.href && !last ? (
                <Link href={crumb.href} className="transition hover:text-ka-green-800 hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "line-clamp-1 font-medium text-ka-text" : ""}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
