"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, ChevronDownIcon, QuestionIcon } from "@/components/icons";
import { FAQ_ITEMS } from "@/lib/faq";

/**
 * The FAQ accordion. Compact by default: the first `initialCount` questions,
 * then "Visa alla frågor". `ids` picks (and orders) a subset - /priser shows
 * only the questions about buying. One answer open at a time.
 */
export function FaqSection({
  ids,
  initialCount = 6,
  title = "Vanliga frågor",
  description = "Det här undrar de flesta innan de skapar sin första analys.",
  contactHref = ROUTES.kontakt,
  sectionId = "faq",
  tone = "sand",
}: {
  ids?: string[];
  initialCount?: number;
  title?: string;
  description?: string;
  contactHref?: string;
  sectionId?: string;
  tone?: "sand" | "cream";
}) {
  const baseId = useId();
  const items = ids
    ? ids.map((id) => FAQ_ITEMS.find((item) => item.id === id)).filter((item) => item !== undefined)
    : FAQ_ITEMS;
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, initialCount);
  const hiddenCount = items.length - visible.length;

  return (
    <section id={sectionId} aria-labelledby={`${baseId}-title`} className={`scroll-mt-24 ${tone === "sand" ? "bg-ka-sand" : "bg-ka-cream"}`}>
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <Reveal variant="left">
            <div className="lg:sticky lg:top-28">
              <p className="inline-flex items-center gap-2 rounded-full bg-ka-sage/70 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
                <QuestionIcon className="h-4 w-4" />
                FAQ
              </p>
              <h2
                id={`${baseId}-title`}
                className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] text-ka-ink sm:text-[44px]"
              >
                {title}
              </h2>
              <p className="mt-4 max-w-[420px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">{description}</p>
              <Link
                href={contactHref}
                className="group mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 transition hover:text-ka-green-900"
              >
                Hittar du inte svaret? Kontakta oss
                <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>

          <Reveal variant="up">
            <div className="divide-y divide-ka-line rounded-[22px] border border-ka-line bg-white shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]">
              {visible.map(({ id, question, answer }) => {
                const open = openId === id;
                const buttonId = `${baseId}-${id}-q`;
                const panelId = `${baseId}-${id}-a`;
                return (
                  <div key={id} className="px-5 sm:px-7">
                    <h3>
                      <button
                        id={buttonId}
                        type="button"
                        onClick={() => setOpenId(open ? null : id)}
                        aria-expanded={open}
                        aria-controls={panelId}
                        className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700"
                      >
                        <span
                          className={`text-[15.5px] font-semibold transition ${
                            open ? "text-ka-green-700" : "text-ka-ink group-hover:text-ka-green-700"
                          }`}
                        >
                          {question}
                        </span>
                        <ChevronDownIcon
                          className={`h-5 w-5 shrink-0 transition-transform duration-300 ${open ? "rotate-180 text-ka-green-700" : "text-ka-muted"}`}
                        />
                      </button>
                    </h3>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      aria-hidden={!open}
                      className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="overflow-hidden">
                        <p className="pb-5 pr-2 text-[14.5px] leading-relaxed text-ka-muted sm:pr-9">{answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ka-line bg-white px-5 py-3 text-[15px] font-semibold text-ka-ink transition hover:border-ka-green-700/40 hover:text-ka-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700"
              >
                Visa alla frågor ({items.length})
                <ChevronDownIcon className="h-4 w-4" />
              </button>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
