"use client";

import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { LANDING_CONTAINER } from "@/components/landing/container";
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
    <section id="problemet" className="relative scroll-mt-24 bg-ka-sand">
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <SectionIntro
          icon={QuestionIcon}
          label="Det som inte står i annonsen"
          title="Jag hittade bostaden. Men är det ett bra köp?"
          description="Annonsen visar det säljaren vill att du ska se. Det som avgör om köpet håller hittar du sällan där."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[1fr_400px]">
          <ol className="grid gap-4 sm:grid-cols-2">
            {QUESTIONS.map((question, i) => (
              <Reveal key={question} variant="up" delay={i * 80} className="h-full">
                <li className="flex h-full items-start gap-4 rounded-[20px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-[16.5px] font-semibold leading-snug text-ka-ink">{question}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal variant="right" className="h-full">
            <div className="flex h-full flex-col justify-center rounded-[20px] bg-ka-green-950 p-8 text-white shadow-[0_30px_60px_-36px_rgba(12,42,31,0.9)]">
              <p className="font-display text-[46px] font-bold leading-none tracking-tight text-ka-mint">
                {formatSek(lagfartSek(EXAMPLE_PRICE_SEK))} kr
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-white/85">
                i lagfart för ett hus som kostar {EXAMPLE_PRICE_SEK / 1_000_000} miljoner. Det står inte i annonsen.
              </p>
              <p className="mt-4 text-xs text-white/55">
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
