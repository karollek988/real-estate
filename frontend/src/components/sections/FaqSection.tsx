"use client";

import { useState } from "react";
import { Reveal } from "@/components/Reveal";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ArrowRightIcon, ChevronDownIcon, QuestionIcon } from "@/components/icons";
import { FAQ_ITEMS } from "@/lib/faq";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 bg-ka-sand">
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <Reveal variant="left">
            <div className="lg:sticky lg:top-28">
              <p className="inline-flex items-center gap-2 rounded-full bg-ka-sage/70 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
                <QuestionIcon className="h-4 w-4" />
                FAQ
              </p>
              <h2 className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] text-ka-ink sm:text-[44px]">
                Alla dina frågor, besvarade
              </h2>
              <p className="mt-4 max-w-[420px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
                Allt du behöver veta om hur analysen fungerar, vad den bygger på och
                vad du kan använda den till.
              </p>
              <a
                href="#contact"
                className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 transition-all hover:gap-3 hover:text-ka-green-900"
              >
                Hittar du inte svaret? Kontakta oss
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
          </Reveal>

          <Reveal variant="up">
            <div className="divide-y divide-ka-line rounded-[22px] border border-ka-line bg-white shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]">
              {FAQ_ITEMS.map(({ question, answer }, i) => {
                const open = openIndex === i;
                return (
                  <div key={question} className="px-6 sm:px-7">
                    <button
                      type="button"
                      onClick={() => setOpenIndex(open ? null : i)}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left"
                    >
                      <span
                        className={`text-[15.5px] font-semibold transition ${
                          open ? "text-ka-green-700" : "text-ka-ink hover:text-ka-green-700"
                        }`}
                      >
                        {question}
                      </span>
                      <ChevronDownIcon
                        className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                          open ? "rotate-180 text-ka-green-700" : "text-ka-muted"
                        }`}
                      />
                    </button>
                    <div
                      id={`faq-panel-${i}`}
                      className={`grid transition-all duration-300 ease-out ${
                        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="pb-5 pr-9 text-[14.5px] leading-relaxed text-ka-muted">
                          {answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
