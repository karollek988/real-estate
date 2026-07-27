"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SectionBackground } from "@/components/SectionBackground";
import { ArrowRightIcon, ShieldIcon } from "@/components/icons";

export function ExampleReportSection() {
  return (
    <section id="example-report" className="relative scroll-mt-24">
      <SectionBackground src="/report-blueprint-picture.png" />
      <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-14">
          <Reveal variant="left" className="w-full lg:w-[58%]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F1417]/70 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              <Image
                src="/example-report.png"
                alt="Exempel på en komplett analysrapport från Köpanalys"
                width={1536}
                height={1024}
                className="h-auto w-full"
              />
            </div>
          </Reveal>

          <Reveal variant="right" className="w-full lg:w-[42%]">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-green-500/25 bg-green-500/10">
              <ShieldIcon className="h-6 w-6 text-green-400" />
            </span>
            <p className="mt-5 text-sm font-semibold text-green-400">Exempelrapport</p>
            <h2 className="mt-2 text-[32px] font-bold leading-tight tracking-tight sm:text-[36px]">
              Se exakt vad du får
            </h2>
            <p className="mt-3 max-w-[420px] text-[15px] leading-relaxed text-neutral-400">
              Gör ditt bostadsköp tryggare med en komplett, datadriven analys — så att du kan
              känna dig säker i ett av livets största beslut.
            </p>

            <Link
              href="/buy"
              className="mt-8 inline-flex items-center gap-2.5 rounded-[10px] bg-green-600 px-6 py-3 text-[15px] font-semibold text-white transition hover:scale-[1.02] hover:bg-green-500 active:scale-[0.99]"
            >
              Skapa analys
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
