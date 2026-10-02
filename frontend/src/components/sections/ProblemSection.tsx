"use client";

import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { QuestionIcon } from "@/components/icons";
import { LAGFART_FEE_SEK, LAGFART_STAMP_DUTY_RATE, lagfartSek } from "@/lib/report/housingCost";
import { formatSek } from "@/lib/pricing";

/** "Det som inte står i annonsen" — the buyer's problem, as the pitch deck puts it. */
const QUESTIONS = [
  "Har föreningen för mycket lån per kvadratmeter?",
  "Väntar ett stambyte eller en avgiftshöjning?",
  "Hur tillgänglig är kommunikationen?",
  "Vad kostar köpet utöver priset?",
];

const EXAMPLE_PRICE_SEK = 4_000_000;

export function ProblemSection() {
  return (
    <section id="problemet" className="relative scroll-mt-24">
      <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20">
        <SectionIntro
          icon={QuestionIcon}
          label="Det som inte står i annonsen"
          title="Jag hittade bostaden. Men är det ett bra köp?"
          description="Annonsen visar det säljaren vill att du ska se. Det som avgör om köpet håller hittar du sällan där."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_380px]">
          <ol className="grid gap-4 sm:grid-cols-2">
            {QUESTIONS.map((question, i) => (
              <Reveal key={question} variant="up" delay={i * 80} className="h-full">
                <li className="flex h-full items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-sm font-semibold text-green-400">
                    {i + 1}
                  </span>
                  <p className="text-[16px] font-medium leading-snug text-neutral-100">{question}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal variant="right" className="h-full">
            <div className="flex h-full flex-col justify-center rounded-2xl border border-green-500/25 bg-green-500/[0.06] p-7">
              <p className="text-[44px] font-bold leading-none tracking-tight text-green-400">
                {formatSek(lagfartSek(EXAMPLE_PRICE_SEK))} kr
              </p>
              <p className="mt-3 text-[16px] leading-relaxed text-neutral-200">
                i lagfart för ett hus som kostar {EXAMPLE_PRICE_SEK / 1_000_000} miljoner. Det står inte i annonsen.
              </p>
              <p className="mt-4 text-xs text-neutral-500">
                Lagfart: {String(LAGFART_STAMP_DUTY_RATE * 100).replace(".", ",")} % av köpeskillingen plus{" "}
                {formatSek(LAGFART_FEE_SEK)} kr i avgift (Lantmäteriet).
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
