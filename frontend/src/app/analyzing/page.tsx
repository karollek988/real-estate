"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import "./ldbar.css";

interface LdBarInstance {
  set: (value: number, doTransition?: boolean) => void;
}

declare global {
  interface Window {
    ldBar?: new (element: HTMLElement) => LdBarInstance;
  }
}

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

const LOADING_VIDEO_SEEK_EPSILON = 0.05;

function AnalyzingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get("id");
  const [currentStage, setCurrentStage] = useState(-1);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [ldBarScriptReady, setLdBarScriptReady] = useState(false);
  const startTime = useRef(Date.now());
  const redirecting = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ldBarElRef = useRef<HTMLDivElement>(null);
  const ldBarInstanceRef = useRef<LdBarInstance | null>(null);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoReady) return;
    const duration = video.duration;
    if (!duration || !Number.isFinite(duration)) return;

    const clampedPct = Math.min(100, Math.max(0, progressPct));
    const targetTime =
      clampedPct >= 100 ? Math.max(0, duration - LOADING_VIDEO_SEEK_EPSILON) : (clampedPct / 100) * duration;

    let raf = 0;
    const step = () => {
      const v = videoRef.current;
      if (!v) return;
      const diff = targetTime - v.currentTime;
      if (Math.abs(diff) < 0.03) {
        v.currentTime = targetTime;
        return;
      }
      v.currentTime += diff * 0.18;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [progressPct, videoReady]);

  useEffect(() => {
    const el = ldBarElRef.current as (HTMLDivElement & { ldBar?: LdBarInstance }) | null;
    if (!ldBarScriptReady || !el || ldBarInstanceRef.current) return;
    const LdBar = window.ldBar;
    if (!LdBar) return;
    // el.ldBar guards against the library's own window "load" auto-init running a second time.
    const instance = el.ldBar ?? new LdBar(el);
    el.ldBar = instance;
    ldBarInstanceRef.current = instance;
    instance.set(progressPct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ldBarScriptReady]);

  useEffect(() => {
    ldBarInstanceRef.current?.set(progressPct);
  }, [progressPct]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111927] px-6 py-16 text-white">
      <Script
        src="/vendor/ldbar/loading-bar.js"
        strategy="afterInteractive"
        onLoad={() => setLdBarScriptReady(true)}
      />
      <div className="flex w-full max-w-lg flex-col items-center gap-10 text-center">
        {/* Logo / brand mark */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-[360px] overflow-hidden rounded-2xl bg-white/[0.02] ring-1 ring-white/[0.06]">
            <video
              ref={videoRef}
              src="/Loading_Icon_Video_Davinci.mp4"
              className="block aspect-square w-full object-contain"
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              controls={false}
              onLoadedMetadata={() => setVideoReady(true)}
            />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            Analyserar fastigheten
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-neutral-400">
            Detta tar vanligen mellan 30 sekunder och 2 minuter beroende på mängden offentlig data som behöver hämtas.
          </p>
        </div>

        {/* Progress readout */}
        <div className="flex w-full flex-col items-center gap-2">
          <span className="w-full text-left text-[11px] text-neutral-500">{elapsed}s</span>
          <div
            ref={ldBarElRef}
            className="ldBar w-full"
            style={{ width: "100%", height: 60 }}
            data-stroke="data:ldbar/res,gradient(0,1,#9df,#9fd,#df9,#fd9)"
            data-path="M10 20Q20 15 30 20Q40 25 50 20Q60 15 70 20Q80 25 90 20"
          />
          <span className="w-full text-right text-[11px] text-neutral-500">{progressPct}%</span>
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
