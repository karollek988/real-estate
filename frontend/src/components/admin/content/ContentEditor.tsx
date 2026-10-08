"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONTENT_IMAGES, findContentImage } from "@/lib/content/images";
import type { UploadedImage } from "@/lib/content/imageUpload";
import {
  CONTENT_CATEGORIES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  readingMinutesFor,
  slugify,
  type ContentInput,
  type ContentItem,
  type ContentType,
} from "@/lib/content/model";
import { CONTENT_BASE_PATHS, contentHref } from "@/lib/content/paths";
import { LIMITS } from "@/lib/content/validate";

type Action = "save" | "publish" | "unpublish";

const FIELD = "w-full rounded-lg border border-ka-line-strong bg-white px-3 py-2 text-sm text-ka-ink outline-none focus:border-ka-green-700 focus:ring-2 focus:ring-ka-green-700/15";
const LABEL = "text-sm font-semibold text-ka-ink";
const HINT = "mt-1 text-xs text-ka-muted";

function emptyInput(): ContentInput {
  return {
    type: "guide",
    slug: "",
    title: "",
    excerpt: "",
    body: "",
    category: null,
    coverImage: null,
    coverImageAlt: "",
    authorName: "Köpanalys",
    readingMinutes: null,
    featured: false,
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    socialImage: null,
  };
}

function toInput(item: ContentItem): ContentInput {
  return {
    type: item.type,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    body: item.body,
    category: item.category,
    coverImage: item.coverImage,
    coverImageAlt: item.coverImageAlt,
    authorName: item.authorName,
    // A stored time that equals the estimate was the estimate: keep it automatic.
    readingMinutes: item.readingMinutes === readingMinutesFor(item.body) ? null : item.readingMinutes,
    featured: item.featured,
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    canonicalUrl: item.canonicalUrl,
    socialImage: item.socialImage,
  };
}

function Counter({ value, max }: { value: string | null; max: number }) {
  const n = value?.length ?? 0;
  return <span className={`text-xs tabular-nums ${n > max ? "font-semibold text-ka-coral-700" : "text-ka-muted"}`}>{`${n}/${max}`}</span>;
}

/**
 * The content editor (/admin/content/new, /admin/content/:id): one form for a
 * guide, insight or news item. Text is Markdown (the subset in
 * lib/content/markdown.ts); pictures are the site's own (lib/content/images.ts)
 * or uploaded here (lib/content/imageUpload.ts). Saving keeps a draft private;
 * publishing puts it on the site within seconds; a draft can be deleted.
 */
export function ContentEditor({ item }: { item?: ContentItem }) {
  const router = useRouter();
  const [saved, setSaved] = useState<ContentItem | undefined>(item);
  const [input, setInput] = useState<ContentInput>(item ? toInput(item) : emptyInput());
  const [slugTouched, setSlugTouched] = useState(Boolean(item));
  const [busy, setBusy] = useState<Action | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const altRef = useRef<HTMLInputElement>(null);

  // The pictures uploaded earlier, for the picker.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/content/images")
      .then((res) => (res.ok ? res.json() : { images: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.images)) setUploaded(data.images);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const estimate = useMemo(() => readingMinutesFor(input.body), [input.body]);
  const published = saved?.status === "published";
  const basePath = CONTENT_BASE_PATHS[input.type];

  function set<K extends keyof ContentInput>(key: K, value: ContentInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  async function submit(action: Action) {
    setBusy(action);
    setErrors([]);
    setNotice(null);
    try {
      const res = await fetch(saved ? `/api/admin/content/${saved.id}` : "/api/admin/content", {
        method: saved ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, input }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrors(data?.error?.details ?? [data?.error?.message ?? "Något gick fel. Försök igen."]);
        return;
      }
      const next: ContentItem = data.item;
      setSaved(next);
      setInput(toInput(next));
      const time = new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
      setNotice(
        `${action === "publish" ? "Publicerad" : action === "unpublish" ? "Avpublicerad – nu ett utkast" : "Sparad"} ${time}.${
          data.warnings?.length ? ` ${data.warnings.join(" ")}` : ""
        }`,
      );
      if (!saved) router.replace(`/admin/content/${next.id}`);
      else router.refresh();
    } catch {
      setErrors(["Kunde inte nå servern. Kontrollera anslutningen och försök igen."]);
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setErrors([]);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/content/images", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrors([data?.error?.message ?? "Bilden kunde inte laddas upp."]);
        return;
      }
      const image: UploadedImage = data.image;
      setUploaded((current) => [image, ...current]);
      // A new picture needs its own description: clear the old one and ask for it.
      setInput((current) => ({ ...current, coverImage: image.src, coverImageAlt: "" }));
      setNotice("Bilden är uppladdad. Skriv en bildbeskrivning (alt-text) för den.");
      requestAnimationFrame(() => altRef.current?.focus());
    } catch {
      setErrors(["Kunde inte nå servern. Kontrollera anslutningen och försök igen."]);
    } finally {
      setUploading(false);
    }
  }

  async function removeDraft() {
    if (!saved || !window.confirm(`Ta bort utkastet "${saved.title}" för gott? Det går inte att ångra.`)) return;
    setDeleting(true);
    setErrors([]);
    try {
      const res = await fetch(`/api/admin/content/${saved.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrors([data?.error?.message ?? "Utkastet kunde inte tas bort."]);
        return;
      }
      router.replace("/admin/content");
      router.refresh();
    } catch {
      setErrors(["Kunde inte nå servern. Kontrollera anslutningen och försök igen."]);
    } finally {
      setDeleting(false);
    }
  }

  const pickable = [...uploaded.map((image) => ({ ...image, alt: "" })), ...CONTENT_IMAGES];
  const coverImage = pickable.find((image) => image.src === input.coverImage);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit("save");
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/content" className="text-xs font-medium text-ka-muted hover:underline">
            ← Allt innehåll
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-ka-ink">{saved ? input.title || "Utan titel" : "Nytt innehåll"}</h1>
          <p className="mt-1 text-sm text-ka-muted">
            {saved ? (published ? "Publicerad – ändringar syns på sajten när du sparar." : "Utkast – syns inte på sajten.") : "Inte sparat ännu."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saved && (
            <Link
              href={`/admin/content/${saved.id}/preview`}
              target="_blank"
              className="rounded-lg border border-ka-line-strong bg-white px-3.5 py-2 text-sm font-semibold text-ka-ink hover:border-ka-green-700"
            >
              Förhandsgranska
            </Link>
          )}
          {saved && published && (
            <Link href={contentHref(saved)} target="_blank" className="rounded-lg border border-ka-line-strong bg-white px-3.5 py-2 text-sm font-semibold text-ka-ink hover:border-ka-green-700">
              Visa live
            </Link>
          )}
          <button
            type="submit"
            disabled={busy !== null}
            className="rounded-lg border border-ka-green-700 bg-white px-3.5 py-2 text-sm font-semibold text-ka-ink hover:bg-ka-ink/[0.05] disabled:opacity-60"
          >
            {busy === "save" ? "Sparar…" : published ? "Spara ändringar" : "Spara utkast"}
          </button>
          {saved && !published && (
            <button
              type="button"
              disabled={busy !== null || deleting}
              onClick={() => void removeDraft()}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-ka-coral-700 hover:bg-ka-coral-100 disabled:opacity-60"
            >
              {deleting ? "Tar bort…" : "Ta bort utkast"}
            </button>
          )}
          {published ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void submit("unpublish")}
              className="rounded-lg border border-ka-coral-300 bg-white px-3.5 py-2 text-sm font-semibold text-ka-coral-700 hover:bg-ka-coral-100 disabled:opacity-60"
            >
              {busy === "unpublish" ? "Avpublicerar…" : "Avpublicera"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void submit("publish")}
              className="rounded-lg bg-ka-green-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-ka-green-800 disabled:opacity-60"
            >
              {busy === "publish" ? "Publicerar…" : "Publicera"}
            </button>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-ka-coral-300 bg-ka-coral-100 px-4 py-3 text-sm text-ka-coral-700">
          <ul className="list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-lg border border-ka-sage bg-ka-sage/40 px-4 py-3 text-sm text-ka-green-800">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5 rounded-lg border border-ka-line-strong bg-white p-5">
          <div>
            <label htmlFor="ce-title" className={LABEL}>
              Titel
            </label>
            <input
              id="ce-title"
              className={`${FIELD} mt-1.5 text-base`}
              value={input.title}
              maxLength={LIMITS.title}
              onChange={(e) => {
                const title = e.target.value;
                setInput((current) => ({ ...current, title, ...(slugTouched ? {} : { slug: slugify(title) }) }));
              }}
            />
          </div>

          <div>
            <label htmlFor="ce-slug" className={LABEL}>
              Adress
            </label>
            <div className="mt-1.5 flex items-center overflow-hidden rounded-lg border border-ka-line-strong bg-ka-paper focus-within:border-ka-green-700">
              <span className="whitespace-nowrap pl-3 text-sm text-ka-muted">{basePath}/</span>
              <input
                id="ce-slug"
                className="min-w-0 flex-1 bg-white px-2 py-2 text-sm outline-none"
                value={input.slug}
                maxLength={LIMITS.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase());
                }}
                onBlur={() => set("slug", slugify(input.slug))}
              />
            </div>
            <p className={HINT}>Kort och beskrivande, bara a–z, siffror och bindestreck. Ändra den helst inte efter publicering – gamla länkar slutar då fungera.</p>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="ce-excerpt" className={LABEL}>
                Sammanfattning
              </label>
              <Counter value={input.excerpt} max={LIMITS.excerpt} />
            </div>
            <textarea id="ce-excerpt" rows={3} className={`${FIELD} mt-1.5`} value={input.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
            <p className={HINT}>En eller två meningar. Visas på kortet, överst i texten och i Google (helst under 160 tecken).</p>
          </div>

          <div>
            <label htmlFor="ce-body" className={LABEL}>
              Text
            </label>
            <textarea
              id="ce-body"
              rows={24}
              className={`${FIELD} mt-1.5 font-mono text-[13.5px] leading-relaxed`}
              value={input.body}
              onChange={(e) => set("body", e.target.value)}
            />
            <details className="mt-2 text-xs text-ka-muted">
              <summary className="cursor-pointer font-semibold">Så formaterar du texten</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <code>## Rubrik</code> – avsnitt (blir innehållsförteckningen), <code>### Underrubrik</code>
                </li>
                <li>
                  <code>- punkt</code> för punktlista, <code>1. steg</code> för numrerad lista
                </li>
                <li>
                  <code>&gt; text</code> – en ”Bra att veta”-ruta
                </li>
                <li>
                  <code>**fet**</code>, <code>*kursiv*</code>, <code>[länktext](/bostadsguider/annan-guide)</code>
                </li>
                <li>Tom rad = nytt stycke. HTML visas som vanlig text.</li>
                <li>Beskriv aldrig hur Köpanalys poängsätter eller väger något – förklara begreppen, inte metoden.</li>
              </ul>
            </details>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <fieldset className="flex min-w-0 flex-col gap-4 rounded-lg border border-ka-line-strong bg-white p-5">
            <legend className="px-1 text-sm font-semibold text-ka-ink">Publicering</legend>
            <div>
              <label htmlFor="ce-type" className={LABEL}>
                Typ
              </label>
              <select id="ce-type" className={`${FIELD} mt-1.5`} value={input.type} onChange={(e) => set("type", e.target.value as ContentType)}>
                {CONTENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CONTENT_TYPE_LABELS[type].one} – {CONTENT_TYPE_LABELS[type].hub}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ce-category" className={LABEL}>
                Kategori
              </label>
              <select
                id="ce-category"
                className={`${FIELD} mt-1.5`}
                value={input.category ?? ""}
                onChange={(e) => set("category", (e.target.value || null) as ContentInput["category"])}
              >
                <option value="">Ingen</option>
                {CONTENT_CATEGORIES.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ce-author" className={LABEL}>
                Författare
              </label>
              <input id="ce-author" className={`${FIELD} mt-1.5`} value={input.authorName} maxLength={LIMITS.authorName} onChange={(e) => set("authorName", e.target.value)} />
            </div>
            <div>
              <label htmlFor="ce-minutes" className={LABEL}>
                Lästid (minuter)
              </label>
              <input
                id="ce-minutes"
                type="number"
                min={1}
                max={120}
                className={`${FIELD} mt-1.5`}
                placeholder={`≈ ${estimate} min (räknas automatiskt)`}
                value={input.readingMinutes ?? ""}
                onChange={(e) => set("readingMinutes", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <label className="flex items-start gap-2.5 text-sm text-ka-ink">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ka-green-700" checked={input.featured} onChange={(e) => set("featured", e.target.checked)} />
              <span>
                <span className="font-semibold">Utvald</span>
                <span className="block text-xs text-ka-muted">Visas stort överst på sidan (den senast publicerade utvalda).</span>
              </span>
            </label>
          </fieldset>

          <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-ka-line-strong bg-white p-5">
            <legend className="px-1 text-sm font-semibold text-ka-ink">Bild</legend>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => set("coverImage", null)}
                className={`flex aspect-[4/3] items-center justify-center rounded-md border text-xs text-ka-muted ${!input.coverImage ? "border-ka-green-700 ring-2 ring-ka-green-700/30" : "border-ka-line-strong"}`}
              >
                Ingen bild
              </button>
              {pickable.map((image) => (
                <button
                  key={image.src}
                  type="button"
                  title={image.label}
                  aria-label={image.label}
                  aria-pressed={input.coverImage === image.src}
                  onClick={() => {
                    setInput((current) => ({
                      ...current,
                      coverImage: image.src,
                      // Offer the picture's own description when there is none yet (or it was another picture's).
                      coverImageAlt: !current.coverImageAlt || findContentImage(current.coverImage)?.alt === current.coverImageAlt ? image.alt : current.coverImageAlt,
                    }));
                  }}
                  className={`relative aspect-[4/3] overflow-hidden rounded-md border ${input.coverImage === image.src ? "border-ka-green-700 ring-2 ring-ka-green-700/40" : "border-ka-line-strong"}`}
                >
                  <Image src={image.src} alt="" fill sizes="120px" className="object-cover" />
                </button>
              ))}
            </div>
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-ka-green-700/40 px-3 py-2.5 text-sm font-semibold text-ka-ink hover:bg-ka-ink/[0.04] focus-within:ring-2 focus-within:ring-ka-green-700/30 ${
                uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {uploading ? "Laddar upp…" : "Ladda upp bild"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file);
                }}
              />
            </label>
            <p className="text-xs text-ka-muted">JPEG, PNG, WebP eller AVIF, högst 12 MB. Bilden förminskas och platsdata (EXIF) tas bort.</p>
            {coverImage && <p className="text-xs text-ka-muted">Vald: {coverImage.label}</p>}
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="ce-alt" className={LABEL}>
                  Bildbeskrivning (alt-text)
                </label>
                <Counter value={input.coverImageAlt} max={LIMITS.coverImageAlt} />
              </div>
              <input id="ce-alt" ref={altRef} className={`${FIELD} mt-1.5`} value={input.coverImageAlt} onChange={(e) => set("coverImageAlt", e.target.value)} />
              <p className={HINT}>Vad bilden visar, för den som inte ser den.</p>
            </div>
          </fieldset>

          <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-ka-line-strong bg-white p-5">
            <legend className="px-1 text-sm font-semibold text-ka-ink">Sök och delning</legend>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="ce-seo-title" className={LABEL}>
                  SEO-titel
                </label>
                <Counter value={input.seoTitle} max={LIMITS.seoTitle} />
              </div>
              <input
                id="ce-seo-title"
                className={`${FIELD} mt-1.5`}
                placeholder="Tom = titeln"
                value={input.seoTitle ?? ""}
                onChange={(e) => set("seoTitle", e.target.value || null)}
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="ce-seo-desc" className={LABEL}>
                  Metabeskrivning
                </label>
                <Counter value={input.seoDescription} max={LIMITS.seoDescription} />
              </div>
              <textarea
                id="ce-seo-desc"
                rows={3}
                className={`${FIELD} mt-1.5`}
                placeholder="Tom = sammanfattningen"
                value={input.seoDescription ?? ""}
                onChange={(e) => set("seoDescription", e.target.value || null)}
              />
            </div>
            <div>
              <label htmlFor="ce-canonical" className={LABEL}>
                Kanonisk adress
              </label>
              <input
                id="ce-canonical"
                className={`${FIELD} mt-1.5`}
                placeholder="Tom = sidans egen adress"
                value={input.canonicalUrl ?? ""}
                onChange={(e) => set("canonicalUrl", e.target.value || null)}
              />
              <p className={HINT}>Bara om texten först publicerats någon annanstans.</p>
            </div>
            <div>
              <label htmlFor="ce-social" className={LABEL}>
                Delningsbild
              </label>
              <select id="ce-social" className={`${FIELD} mt-1.5`} value={input.socialImage ?? ""} onChange={(e) => set("socialImage", e.target.value || null)}>
                <option value="">Samma som bilden</option>
                {pickable.map((image) => (
                  <option key={image.src} value={image.src}>
                    {image.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-md border border-ka-line-strong bg-ka-paper p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ka-muted">Så kan det se ut i Google</p>
              <p className="mt-1.5 truncate text-[15px] text-[#1a0dab]">{(input.seoTitle || input.title || "Titel") + " | Köpanalys"}</p>
              <p className="truncate text-xs text-[#006621]">kopanalys.se{basePath}/{input.slug || "adress"}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-ka-text">{input.seoDescription || input.excerpt || "Sammanfattningen visas här."}</p>
            </div>
          </fieldset>
        </div>
      </div>
    </form>
  );
}
