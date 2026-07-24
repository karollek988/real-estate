"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STAGES = [
  { message: "Locating property in public records", duration: 8300 },
  { message: "Verifying address and coordinates", duration: 9300 },
  { message: "Collecting market data", duration: 12400 },
  { message: "Gathering neighbourhood information", duration: 10300 },
  { message: "Analysing housing association finances", duration: 14500 },
  { message: "Reading financial statements", duration: 11400 },
  { message: "Evaluating risk factors", duration: 9300 },
  { message: "Assessing future development potential", duration: 8300 },
  { message: "Building your decision report", duration: 6200 },
];

function AnalyzingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get("id");
  const [currentStage, setCurrentStage] = useState(-1);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const redirecting = useRef(false);

  useEffect(() => {
    startTime.current = Date.now();

    const elapsedInterval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 500);

    let stageTimer: ReturnType<typeof setTimeout>;
    let stageIndex = -1;

    function advanceStage() {
      stageIndex++;
      if (stageIndex < STAGES.length) {
        setCurrentStage(stageIndex);
        stageTimer = setTimeout(() => {
          setCompletedStages((prev) => [...prev, stageIndex]);
          advanceStage();
        }, STAGES[stageIndex].duration);
      }
    }

    advanceStage();

    return () => {
      clearInterval(elapsedInterval);
      clearTimeout(stageTimer);
    };
  }, []);

  useEffect(() => {
    if (!analysisId) return;

    const pollInterval = setInterval(async () => {
      if (redirecting.current) return;
      try {
        const res = await fetch(`/api/analyses/${analysisId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.analysis?.status === "complete" || data.analysis?.status === "failed") {
          redirecting.current = true;
          clearInterval(pollInterval);
          router.push(`/report?id=${analysisId}`);
        }
      } catch {
        // keep polling on transient errors
      }
    }, 1200);

    return () => clearInterval(pollInterval);
  }, [analysisId, router]);

  const isCurrentStageActive = currentStage >= 0 && !completedStages.includes(currentStage);
  const progressPct = Math.min(
    100,
    Math.round(((completedStages.length + (isCurrentStageActive ? 0.5 : 0)) / STAGES.length) * 100)
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111927] px-6 py-16 text-white">
      <div className="flex w-full max-w-lg flex-col items-center gap-10 text-center">
        {/* Logo / brand mark */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-full border-[1.5px] border-white/[0.08]" />
            <div className="absolute inset-0 animate-spin rounded-full border-[1.5px] border-transparent border-t-emerald-400" style={{ animationDuration: "1.8s" }} />
            <div className="absolute inset-2 animate-spin rounded-full border-[1.5px] border-transparent border-t-emerald-400/40" style={{ animationDuration: "2.8s", animationDirection: "reverse" }} />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            Analyserar fastigheten
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-neutral-400">
            Detta tar vanligen mellan 30 sekunder och 2 minuter beroende på hur mängden offentlig data som behöver hämtas.
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
            <span>{elapsed}s</span>
            <span>{progressPct}%</span>
          </div>
        </div>

        {/* Stage checklist */}
        <div className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-left backdrop-blur-sm">
          <ul className="flex flex-col gap-1.5">
            {STAGES.map((stage, i) => {
              const isComplete = completedStages.includes(i);
              const isActive = currentStage === i && !isComplete;

              return (
                <li
                  key={i}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-500 ${
                    isActive ? "bg-white/[0.03]" : ""
                  }`}
                >
                  {/* Status icon */}
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                      isComplete
                        ? "bg-emerald-500/15 text-emerald-400"
                        : isActive
                          ? "border border-emerald-500/40 bg-emerald-500/10"
                          : "border border-white/[0.06] bg-transparent"
                    }`}
                  >
                    {isComplete ? (
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6.5L5 9L9.5 3"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : isActive ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ) : null}
                  </span>

                  {/* Label */}
                  <span
                    className={`text-sm transition-colors duration-500 ${
                      isComplete
                        ? "text-neutral-200"
                        : isActive
                          ? "text-neutral-100 font-medium"
                          : "text-neutral-600"
                    }`}
                  >
                    {stage.message}
                  </span>

                  {/* Spinner for active stage */}
                  {isActive && (
                    <span className="ml-auto">
                      <svg className="h-3.5 w-3.5 animate-spin text-emerald-400/60" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                      </svg>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-xs text-neutral-600">
          Bygger Köpanalys beslutsunderlag
        </p>
      </div>
    </div>
  );
}

export default function AnalyzingPage() {
  return (
    <Suspense fallback={null}>
      <AnalyzingContent />
    </Suspense>
  );
}
