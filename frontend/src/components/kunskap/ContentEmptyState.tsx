import { Link, type Href } from "@/i18n/navigation";
import { ArrowRightIcon, BookOpenIcon } from "@/components/icons";
import { hrefKey } from "@/components/site/navigation";

/**
 * A hub with nothing published yet: says so plainly and offers somewhere
 * useful to go instead, rather than an empty grid.
 */
export function ContentEmptyState({
  title,
  text,
  links,
}: {
  title: string;
  text: string;
  links: { label: string; href: Href }[];
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-ka-line-strong bg-white p-7 shadow-ka-card sm:p-10 lg:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-6 h-[110px] w-[820px] bg-[url('/images/header-contours.svg')] bg-[length:820px_102px] bg-no-repeat opacity-50"
      />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-ka-sage text-ka-green-900">
        <BookOpenIcon className="h-7 w-7" strokeWidth={1.6} />
      </span>
      <p className="relative mt-6 font-display text-[26px] font-bold leading-tight text-ka-ink sm:text-[32px]">{title}</p>
      <p className="relative mt-3 max-w-[620px] text-[16.5px] leading-relaxed text-ka-muted">{text}</p>
      <ul className="relative mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {links.map(({ label, href }) => (
          <li key={hrefKey(href)}>
            <Link
              href={href}
              className="group inline-flex h-12 items-center gap-2 rounded-[12px] border-[1.5px] border-ka-green-900/25 bg-ka-cream px-5 text-[15px] font-semibold text-ka-ink transition hover:border-ka-green-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2"
            >
              {label}
              <ArrowRightIcon className="h-4 w-4 text-ka-green-700 transition-transform group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
