"use client";

import "leaflet/dist/leaflet.css";
import "@/components/admin/atlas/atlas-public.scss";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AtlasHandle } from "@/components/admin/atlas/atlas";
import { ROUTES } from "@/components/site/navigation";

/**
 * The public map (/karta): the same map workspace as the admin portal
 * (components/admin/atlas, ported from KopanalysMapDemo) in its public
 * variant, styled by atlas-public.scss. The workspace renders its own DOM into
 * the div below, so React never renders children into it; it is imported on
 * the client only, because Leaflet needs the DOM when it loads.
 *
 * ?q= is searched when the map opens and again whenever it changes, so the
 * header's search works whether or not the map is already open.
 */
export function PublicMap() {
  const router = useRouter();
  const t = useTranslations("map");
  const locale = useLocale();
  // read when the map mounts; the map is rebuilt for a new language by the page itself (a new address), not by a re-render
  const textsRef = useRef({ t, locale });
  useEffect(() => {
    textsRef.current = { t, locale };
  });
  const searchParams = useSearchParams();
  const query = (searchParams?.get("q") ?? "").slice(0, 120);
  const rootRef = useRef<HTMLDivElement>(null);
  const atlasRef = useRef<AtlasHandle | null>(null);
  const searchedRef = useRef(query);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    import("@/components/admin/atlas/atlas")
      .then(({ mountAtlas }) => {
        if (cancelled) return;
        atlasRef.current = mountAtlas(root, {
          variant: "public",
          initialQuery: searchedRef.current,
          onCreateAnalysis: () => router.push(ROUTES.skapaAnalys),
          // the map is plain code that asks for its texts by key: the "map" messages, in the language of the page
          t: (key, values) => textsRef.current.t(key as never, values as never),
          locale: textsRef.current.locale,
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      atlasRef.current?.unmount();
      atlasRef.current = null;
    };
  }, [router]);

  // A new search from the header while the map is open.
  useEffect(() => {
    if (!query || query === searchedRef.current) return;
    searchedRef.current = query;
    atlasRef.current?.search(query);
  }, [query]);

  return (
    <div className="relative h-full">
      <div ref={rootRef} className="atlas-root atlas-public" />
      {status === "loading" && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ka-muted">{t("loading")}</p>
      )}
      {status === "failed" && (
        <p role="alert" className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ka-text">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
