import Link from "next/link";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { KUNSKAP_MENU } from "@/components/site/navigation";
import { ArrowRightIcon, BookOpenIcon } from "@/components/icons";

/**
 * A small pointer to the Kunskap pages (Bostadsguiden, Insikter, Nyheter). The articles
 * themselves live on their own pages, not on the landing page.
 */
export function KnowledgeSection() {
  return (
    <section aria-labelledby="kunskap-title" className="bg-ka-cream">
      <div className={`${LANDING_CONTAINER} py-16 lg:py-20`}>
        <div className="grid gap-6 rounded-[24px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)] sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:items-center lg:gap-10 lg:p-10">
          <div>
            <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-700">
              <BookOpenIcon className="h-4 w-4" />
              Kunskap
            </p>
            <h2 id="kunskap-title" className="mt-3 font-display text-[28px] font-bold leading-[1.12] tracking-[-0.01em] text-ka-ink sm:text-[32px]">
              Bli tryggare inför ditt köp
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ka-muted">Guider, insikter och nyheter om bostadsmarknaden.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {KUNSKAP_MENU.map(({ label, description, href, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex h-full flex-col rounded-[18px] border border-ka-line bg-ka-cream/60 p-5 transition hover:-translate-y-0.5 hover:border-ka-green-700/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700"
                >
                  <Icon className="h-7 w-7 text-ka-green-800" strokeWidth={1.5} />
                  <span className="mt-4 flex items-center gap-1.5 text-[16.5px] font-bold text-ka-ink">
                    {label}
                    <ArrowRightIcon className="h-4 w-4 text-ka-green-700 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                  <span className="mt-1 text-[14px] leading-snug text-ka-muted">{description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
