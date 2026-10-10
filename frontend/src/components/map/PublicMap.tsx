"use client";

import "leaflet/dist/leaflet.css";
import "@/components/admin/atlas/atlas-public.scss";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AtlasHandle, ListingStore, ListingWrite } from "@/components/admin/atlas/atlas";
import { AuthModal } from "@/components/AuthModal";
import { ROUTES } from "@/components/site/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { MapListingDto } from "@/lib/map/types";

/**
 * The public map (/karta): the same map workspace as the admin portal
 * (components/admin/atlas, ported from KopanalysMapDemo) in its public
 * variant, styled by atlas-public.scss. The workspace renders its own DOM into
 * the div below, so React never renders children into it; it is imported on
 * the client only, because Leaflet needs the DOM when it loads.
 *
 * ?q= is searched when the map opens and again whenever it changes, so the
 * header's search works whether or not the map is already open.
 *
 * The pins live in the site's database (app/api/map): everyone can look, only signed-in
 * users can post, edit and remove their own. The map asks for the sign-in dialog through
 * requireSignIn, and fetches the pins again when someone signs in or out.
 */
/** Asks the site for translations of listing texts; null for each text that could not be translated. */
async function translateListings(texts: string[], target: string): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (let i = 0; i < texts.length; i += 30) {
    const slice = texts.slice(i, i + 30);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: slice, target }),
      });
      const body = response.ok ? ((await response.json()) as { translations?: (string | null)[] }) : null;
      out.push(...slice.map((_, j) => body?.translations?.[j] ?? null));
    } catch {
      out.push(...slice.map(() => null));
    }
  }
  return out;
}

/** The map's pins, through the site's API. A failure carries the site's own words for the visitor. */
function createListingStore(fallbackMessage: () => string): ListingStore {
  async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch {
      throw new Error(fallbackMessage());
    }
    const body = (await response.json().catch(() => null)) as ({ error?: { message?: string } } & T) | null;
    if (!response.ok) throw new Error(body?.error?.message || fallbackMessage());
    return body as T;
  }
  const json = (method: string, body: ListingWrite): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return {
    list: async () => (await call<{ listings: MapListingDto[] }>("/api/map/listings")).listings,
    create: async (input) => (await call<{ listing: MapListingDto }>("/api/map/listings", json("POST", input))).listing,
    update: async (id, input) => (await call<{ listing: MapListingDto }>(`/api/map/listings/${id}`, json("PATCH", input))).listing,
    remove: async (id) => {
      await call(`/api/map/listings/${id}`, { method: "DELETE" });
    },
    uploadImage: async (dataUrl) => {
      const form = new FormData();
      form.append("file", await (await fetch(dataUrl)).blob(), "photo.jpg");
      return (await call<{ path: string }>("/api/map/images", { method: "POST", body: form })).path;
    },
    ensureTransport: async (id) => {
      try {
        return (await call<{ listing: MapListingDto }>(`/api/map/listings/${id}/transport`, { method: "POST" })).listing;
      } catch {
        return null;
      }
    },
  };
}

export function PublicMap() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  const [authOpen, setAuthOpen] = useState(false);
  const t = useTranslations("map");
  const locale = useLocale();
  // read when the map mounts; the map is rebuilt for a new language by the page itself (a new address), not by a re-render
  const textsRef = useRef({ t, locale });
  useEffect(() => {
    textsRef.current = { t, locale };
    userIdRef.current = userId;
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
          // what visitors wrote in their own listings, shown in the page's language (translated by the site's server)
          translate: (texts) => translateListings(texts, textsRef.current.locale),
          // the pins are in the site's database; only signed-in users may post
          store: createListingStore(() => textsRef.current.t("form.saveFailed" as never)),
          isSignedIn: () => userIdRef.current !== null,
          requireSignIn: () => setAuthOpen(true),
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

  // Signing in or out changes which pins are the visitor's own, and which hidden ones they may see.
  const loadedFor = useRef(userId);
  useEffect(() => {
    if (loadedFor.current === userId) return;
    loadedFor.current = userId;
    atlasRef.current?.reload();
  }, [userId]);

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
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} stayOnPage />
    </div>
  );
}
