import Link from "next/link";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ChevronRightIcon } from "@/components/icons";
import { ROUTES, type NavIcon } from "@/components/site/navigation";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * The top of every public page below the landing page: breadcrumbs, a
 * category pill, the page's H1, a short lead and optional actions, with an
 * optional visual on the right. Server-rendered, no animation - the H1 is
 * the page's most important text and shows immediately.
 */
export function PageHero({
  icon: Icon,
  eyebrow,
  title,
  lead,
  crumbs = [],
  actions,
  aside,
  titleId = "page-title",
}: {
  icon: NavIcon;
  eyebrow: string;
  title: React.ReactNode;
  lead: React.ReactNode;
  /** Trail after "Start"; the last one is the current page. */
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <section aria-labelledby={titleId} className="relative overflow-hidden border-b border-ka-line/70 bg-ka-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-0 hidden h-[140px] w-[1000px] bg-[url('/images/header-contours.svg')] bg-[length:1000px_125px] bg-no-repeat opacity-40 lg:block"
      />
      <div
        className={`${LANDING_CONTAINER} relative grid gap-10 pb-14 pt-8 sm:pt-10 lg:pb-20 ${
          aside ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16" : ""
        }`}
      >
        <div className="max-w-[760px]">
          <nav aria-label="Brödsmulor">
            <ol className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-ka-muted">
              <li>
                <Link href={ROUTES.home} className="transition hover:text-ka-green-800 hover:underline">
                  Start
                </Link>
              </li>
              {crumbs.map((crumb, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <li key={crumb.label} className="flex items-center gap-1.5">
                    <ChevronRightIcon className="h-3.5 w-3.5 text-ka-muted/70" strokeWidth={2} />
                    {crumb.href && !last ? (
                      <Link href={crumb.href} className="transition hover:text-ka-green-800 hover:underline">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-ka-text" : ""}>
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-ka-sage/75 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
            <Icon className="h-4 w-4" />
            {eyebrow}
          </p>
          <h1
            id={titleId}
            className="mt-5 font-display text-[38px] font-bold leading-[1.05] tracking-[-0.02em] text-ka-ink sm:text-[50px] lg:text-[58px]"
          >
            {title}
          </h1>
          <div className="mt-5 max-w-[620px] text-[17px] leading-[1.6] text-ka-muted sm:text-[18px]">{lead}</div>
          {actions && <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{actions}</div>}
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
    </section>
  );
}

const BUTTON_BASE =
  "group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[12px] px-6 text-[15.5px] font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-ka-cream";

/** The page's main action: deep green. */
export const PRIMARY_BUTTON = `${BUTTON_BASE} bg-ka-green-900 text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] hover:bg-ka-green-800`;

/** A second action next to it: white with a green outline. */
export const SECONDARY_BUTTON = `${BUTTON_BASE} border-[1.5px] border-ka-green-900/30 bg-white text-ka-ink hover:border-ka-green-900`;
