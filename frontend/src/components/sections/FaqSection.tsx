"use client";

import { useState } from "react";
import { Reveal } from "@/components/Reveal";
import { ArrowRightIcon, ChevronDownIcon, QuestionIcon } from "@/components/icons";
import { FAQ_ITEMS } from "@/lib/faq";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-[1400px] px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <Reveal variant="left">
            <div className="lg:sticky lg:top-10">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-green-500/25 bg-green-500/10">
                <QuestionIcon className="h-6 w-6 text-green-400" />
              </span>
              <p className="mt-5 text-sm font-semibold text-green-400">FAQ</p>
              <h2 className="mt-2 text-[32px] font-bold leading-tight tracking-tight sm:text-[36px]">
                Alla dina frågor, besvarade
              </h2>
              <p className="mt-3 max-w-[400px] text-[15px] leading-relaxed text-neutral-400">
                Allt du behöver veta om hur analysen fungerar, vad den bygger på och
                vad du kan använda den till.
              </p>
              <a
                href="#"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-green-400 transition-all hover:gap-3 hover:text-green-300"
              >
                Hittar du inte svaret? Kontakta oss
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
          </Reveal>

          <Reveal variant="up">
            <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
              {FAQ_ITEMS.map(({ question, answer }, i) => {
                const open = openIndex === i;
                return (
                  <div key={question} className="px-6">
                    <button
                      type="button"
                      onClick={() => setOpenIndex(open ? null : i)}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left"
                    >
                      <span
                        className={`text-[15px] font-semibold transition ${
                          open ? "text-white" : "text-neutral-200 hover:text-white"
                        }`}
                      >
                        {question}
                      </span>
                      <ChevronDownIcon
                        className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                          open ? "rotate-180 text-green-400" : "text-neutral-500"
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
                        <p className="pb-5 pr-9 text-sm leading-relaxed text-neutral-400">
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
