import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { ROUTES } from "@/components/site/navigation";

export interface Crumb {
  label: string;
  href?: string;
}

/** "Start › Kunskap › Bostadsguiden": the trail after Start; the last crumb is the current page. */
export function Breadcrumbs({ crumbs, className = "" }: { crumbs: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Brödsmulor" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-ka-muted">
        <li>
          <Link href={ROUTES.home} className="transition hover:text-ka-green-800 hover:underline">
            Start
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
