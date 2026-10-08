/**
 * Atlas map workspace - the KopanalysMapDemo project, now the public map page /karta.
 * Ported from github.com/intothenether/KopanalysMapDemo (src/main.ts, commit 10152df).
 * Colours are not set here: the stylesheet owns them (the exchange line's stroke included),
 * so the map follows the master variables in styles/_variables.scss.
 *
 * Changes from the standalone original (data, markup and behaviour are otherwise unchanged):
 *  - the script is wrapped in mountAtlas(root), which renders into `root` and returns a
 *    cleanup function, so React can mount and unmount it;
 *  - DOM lookups are scoped to `root` instead of `document`;
 *  - user-entered and geocoder-supplied text is HTML-escaped before it is put into markup,
 *    and link / image URLs are limited to safe schemes (the original interpolated them raw);
 *  - localStorage reads tolerate missing or corrupt data instead of crashing the page;
 *  - the topbar logo goes through Next's image optimizer (/_next/image) instead of loading the
 *    1 MB original for a 32px icon;
 *  - the CSS imports live in pages/_app.tsx (Pages Router only allows global CSS there);
 *  - since 2026-10-05 the same workspace is also the public map page /karta
 *    (components/map/PublicMap.tsx) through `variant: 'public'`: no brand (the site header has
 *    it), no demo BankID sign-in, inbox or sign-out (the site header has the real sign-in),
 *    "Mina annonser" open to everyone, "Skapa analys" wired to the analysis form, no
 *    search-as-you-type against Nominatim (its usage policy does not allow autocomplete), and
 *    a preview notice in the top bar next to the search (the page itself renders the h1, so
 *    the sidebar heading is an h2). Its CSS is atlas-public.scss.
 *
 * Browser-only: it touches window/document/localStorage on mount and imports Leaflet, which
 * needs the DOM at import time - load it via dynamic import() from an effect, never on the server.
 */
import L from 'leaflet'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function esc(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]) }
function safeHref(value: string | undefined): string | undefined {
  if (!value) return undefined
  try { const url = new URL(value, window.location.href); return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined } catch { return undefined }
}
function safeImage(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value
  return safeHref(value)
}
// The detail panel's close button. First in the panel, in a row with no height of its own, so the
// stylesheet can put it in the panel's top right corner - over the photo when there is one.
const detailClose = (label: string) => `<div class="detail-close-bar"><button class="detail-close" id="detail-close" aria-label="${esc(label)}">×</button></div>`
const DEFAULT_LISTING_PHOTO = 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80'
function readStoredPins(key: string, fallback: SavedPin[]): SavedPin[] {
  try { const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); return Array.isArray(parsed) ? (parsed as SavedPin[]) : structuredClone(fallback) } catch { return structuredClone(fallback) }
}

type PinKind = 'sale' | 'buyer' | 'exchange'
type SavedPin = { id: number; title: string; note: string; lat: number; lng: number; details?: string; meta?: string; image?: string; link?: string; isMine?: boolean }
type ExchangeLocation = { note: string; lat: number; lng: number }
type ExchangePin = { id: number; title: string; from: ExchangeLocation; to: ExchangeLocation; details?: string; meta?: string; image?: string; isMine?: boolean }

const storageKey = 'kopanalys-map-pins'
const buyerStorageKey = 'kopanalys-map-buyers'
const exchangeStorageKey = 'kopanalys-map-exchanges'
// The example listings: where they are, their pictures and links. Their words (note, description, price line)
// are in the messages (map.samples.*), so each visitor reads them in their own language.
const sampleSale: Array<Pick<SavedPin, 'id' | 'title' | 'image' | 'link' | 'lat' | 'lng'>> = [
  { id: 1, title: 'Kanalgatan 41C', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 55.83626936841034, lng: 13.301669377943158 },
  { id: 2, title: 'Hörngatan 11', image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 58.27749450906411, lng: 12.285267106116207 },
  { id: 3, title: 'Timmermansgatan 22', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3151, lng: 18.071 },
  { id: 4, title: 'Sveavägen 98', image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3428, lng: 18.0448 },
  { id: 5, title: 'Strandvägen 7', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3358, lng: 18.0894 },
  { id: 6, title: 'Fleminggatan 45', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3325, lng: 18.0326 },
  { id: 7, title: 'Västerlånggatan 15', image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3251, lng: 18.0711 },
  { id: 8, title: 'Ulvsundavägen 106', image: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.34, lng: 17.9294 },
  { id: 9, title: 'Råsundavägen 12', image: 'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3601, lng: 17.9956 },
  { id: 10, title: 'Sicklastråket 3', image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3053, lng: 18.1109 },
  { id: 11, title: 'Täby Torg 5', image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.4439, lng: 18.0687 },
  { id: 12, title: 'Larsviksvägen 9', image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3656, lng: 18.1353 },
  { id: 13, title: 'Enskedevägen 88', image: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.2809, lng: 18.081 },
  { id: 14, title: 'Maltesholmsvägen 41', image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3623, lng: 17.8371 },
  { id: 15, title: 'Årsta Torg 6', image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.2934, lng: 18.0553 },
]
const sampleBuyers: Array<Pick<SavedPin, 'id' | 'lat' | 'lng'>> = [
  { id: 101, lat: 59.312612847910174, lng: 18.06196320281545 },
  { id: 102, lat: 59.40263434990332, lng: 17.943175200850128 },
  { id: 103, lat: 59.3448, lng: 18.048 },
  { id: 104, lat: 59.3372, lng: 18.092 },
  { id: 105, lat: 59.304, lng: 17.972 },
  { id: 106, lat: 59.343, lng: 17.926 },
  { id: 107, lat: 59.359, lng: 18 },
  { id: 108, lat: 59.3095, lng: 18.158 },
  { id: 109, lat: 59.447, lng: 18.07 },
  { id: 110, lat: 59.3105, lng: 18.019 },
  { id: 111, lat: 59.2915, lng: 18.061 },
  { id: 112, lat: 59.2845, lng: 18.078 },
  { id: 113, lat: 59.3615, lng: 17.97 },
  { id: 114, lat: 59.402, lng: 18.04 },
  { id: 115, lat: 59.858, lng: 17.635 },
]
const sampleExchanges: Array<Pick<ExchangePin, 'id'> & { from: { lat: number; lng: number }; to: { lat: number; lng: number } }> = [
  { id: 201, from: { lat: 59.3151, lng: 18.071 }, to: { lat: 59.3325, lng: 18.0326 } },
  { id: 202, from: { lat: 59.34, lng: 17.9294 }, to: { lat: 59.8586, lng: 17.6389 } },
  { id: 203, from: { lat: 59.345, lng: 18.05 }, to: { lat: 59.307, lng: 18.014 } },
  { id: 204, from: { lat: 59.338, lng: 18.085 }, to: { lat: 59.345, lng: 17.935 } },
  { id: 205, from: { lat: 59.33, lng: 18.028 }, to: { lat: 59.308, lng: 18.16 } },
  { id: 206, from: { lat: 59.303, lng: 17.97 }, to: { lat: 59.44, lng: 18.065 } },
  { id: 207, from: { lat: 59.295, lng: 18.05 }, to: { lat: 59.318, lng: 18.065 } },
  { id: 208, from: { lat: 59.362, lng: 17.99 }, to: { lat: 59.363, lng: 17.968 } },
  { id: 209, from: { lat: 59.2478, lng: 18.0972 }, to: { lat: 59.283, lng: 18.085 } },
  { id: 210, from: { lat: 59.2701, lng: 18.1183 }, to: { lat: 59.3617, lng: 17.8697 } },
  { id: 211, from: { lat: 59.4014, lng: 18.0378 }, to: { lat: 59.3956, lng: 18.0817 } },
  { id: 212, from: { lat: 59.32, lng: 18.075 }, to: { lat: 57.7072, lng: 11.9668 } },
  { id: 213, from: { lat: 59.347, lng: 18.04 }, to: { lat: 55.605, lng: 13.0038 } },
  { id: 214, from: { lat: 59.335, lng: 18.035 }, to: { lat: 59.6099, lng: 16.5448 } },
  { id: 215, from: { lat: 59.8586, lng: 17.6389 }, to: { lat: 59.331, lng: 18.03 } },
]

export interface AtlasOptions {
  /** 'admin' (default) is the admin portal's workspace; 'public' is /karta - see the header comment. */
  variant?: 'admin' | 'public'
  /** Looked up as soon as the map is ready (/karta?q=...). */
  initialQuery?: string
  /** The "Skapa analys" button in a listing's detail panel. */
  onCreateAnalysis?: () => void
  /** The map's texts: the "map" messages by key, t('form.save'), in the language of the page. */
  t: (key: string, values?: Record<string, string | number>) => string
  /** The page's language code ("sv", "en"): the place-name search answers in it. */
  locale: string
  /**
   * Translates what visitors wrote in their own listings into the page's language (POST /api/translate). Gets the
   * texts, gives back a translation for each, or null where there is none. Not used for Swedish.
   */
  translate?: (texts: string[]) => Promise<(string | null)[]>
}

export interface AtlasHandle {
  /** Looks a query up among the pins, then as a place in Sweden - the search form's own search. */
  search: (query: string) => void
  unmount: () => void
}

export function mountAtlas(root: HTMLElement, options: AtlasOptions): AtlasHandle {
  const isPublic = options.variant === 'public'
  const { t } = options
  /** A text of the map, ready to go inside markup. */
  const e = (key: string, values?: Record<string, string | number>) => esc(t(key, values))

  // The example listings in the visitor's language. A listing the visitor saved keeps their own words; the
  // example listings among the saved ones are shown in the language of the page.
  const saleDefaults = (): SavedPin[] => sampleSale.map((s) => ({ ...s, note: t(`samples.sale.${s.id}.note`), details: t(`samples.sale.${s.id}.details`), meta: t(`samples.sale.${s.id}.meta`) }))
  const buyerDefaults = (): SavedPin[] => sampleBuyers.map((s) => ({ ...s, title: t(`samples.buyer.${s.id}.title`), note: t(`samples.buyer.${s.id}.note`), details: t(`samples.buyer.${s.id}.details`), meta: t(`samples.buyer.${s.id}.meta`) }))
  const exchangeDefaults = (): ExchangePin[] => sampleExchanges.map((s) => ({
    id: s.id,
    title: t(`samples.exchange.${s.id}.title`),
    details: t(`samples.exchange.${s.id}.details`),
    meta: t(`samples.exchange.${s.id}.meta`),
    from: { ...s.from, note: t(`samples.exchange.${s.id}.fromNote`) },
    to: { ...s.to, note: t(`samples.exchange.${s.id}.toNote`) },
  }))
  function inLanguage<T extends { id: number; isMine?: boolean }>(stored: T[], defaults: T[]): T[] {
    const byId = new Map(defaults.map((item) => [item.id, item]))
    return stored.map((item) => (!item.isMine && byId.has(item.id) ? { ...item, ...byId.get(item.id)! } : item))
  }

  let pins: SavedPin[] = inLanguage(readStoredPins(storageKey, saleDefaults()), saleDefaults())
  let buyerPins: SavedPin[] = inLanguage(readStoredPins(buyerStorageKey, buyerDefaults()), buyerDefaults())
  function loadExchangePins(): ExchangePin[] {
    try {
      const raw = localStorage.getItem(exchangeStorageKey)
      if (!raw) return exchangeDefaults()
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item === 'object' && 'from' in item && 'to' in item)) return inLanguage(parsed as ExchangePin[], exchangeDefaults())
      return exchangeDefaults()
    } catch { return exchangeDefaults() }
  }
  let exchangePins: ExchangePin[] = loadExchangePins()
  const visibleKinds: Record<PinKind, boolean> = { sale: true, buyer: true, exchange: true }

  // What visitors wrote in their own listings, translated into the page's language (the example listings come
  // translated from the messages). translations: the wording as written -> its translation. A listing whose id is in
  // showOriginal is shown as written, because the reader asked for that.
  const translationStorageKey = `kopanalys-map-translations-${options.locale}`
  const translations = new Map<string, string>()
  try { Object.entries(JSON.parse(localStorage.getItem(translationStorageKey) ?? '{}') as Record<string, string>).forEach(([from, to]) => translations.set(from, to)) } catch { /* nothing remembered */ }
  const triedToTranslate = new Set<string>()
  const showOriginal = new Set<string>()
  /** A text in the page's language when there is a translation of it, else as written. */
  const txt = (text: string): string => translations.get(text) ?? text
  const shown = (text: string | undefined, key: string): string | undefined => (text === undefined || showOriginal.has(key) ? text : txt(text))
  const hasTranslation = (texts: Array<string | undefined>): boolean => texts.some((text) => text !== undefined && translations.has(text))
  async function translateUserListings() {
    if (!options.translate || options.locale === 'sv') return
    const wording = new Set<string>()
    const add = (text: string | undefined) => { if (text && text.trim() && !translations.has(text) && !triedToTranslate.has(text)) wording.add(text) }
    // not the places (note, from, to): a name like "Södermalm" is not translated
    for (const pin of [...pins, ...buyerPins]) if (pin.isMine) [pin.title, pin.meta, pin.details].forEach(add)
    for (const pin of exchangePins) if (pin.isMine) [pin.title, pin.meta, pin.details].forEach(add)
    const texts = [...wording]
    if (texts.length === 0) return
    texts.forEach((text) => triedToTranslate.add(text))
    let answers: (string | null)[]
    try { answers = await options.translate(texts) } catch { return }
    let changed = false
    texts.forEach((text, i) => { const answer = answers[i]; if (answer && answer !== text) { translations.set(text, answer); changed = true } })
    if (!changed) return
    try { localStorage.setItem(translationStorageKey, JSON.stringify(Object.fromEntries(translations))) } catch { /* storage full or blocked */ }
    renderPins()
  }

  // On /karta the site layout already has the page's <main>.
  const shellTag = isPublic ? 'div' : 'main'
  root.innerHTML = `
    <${shellTag} class="app-shell">
      <header class="topbar">
        ${isPublic ? '' : '<a class="brand" href="/" aria-label="Köpanalys Karta"><img class="brand-mark" src="/_next/image?url=%2Fkopanalys-bostad-logo.png&w=64&q=75" alt="Köpanalys"><span>Köpanalys Karta</span></a>'}
        <form class="search-form" id="search-form" role="search"><span class="search-icon">⌕</span><input id="search-input" list="search-suggestions" type="search" placeholder="${e('search.placeholder')}" autocomplete="off" aria-label="${e('search.label')}"><datalist id="search-suggestions"></datalist><button type="submit">${e('search.button')}</button></form>
        ${isPublic ? `<div class="map-notice"><strong class="map-notice-title">${e('notice.title')}</strong><span class="map-notice-badge">${e('notice.badge')}</span><p>${e('notice.text')}</p></div>` : ''}
        <div class="topbar-actions">
          ${isPublic ? `<div class="auth-actions" id="auth-actions"><button class="icon-button" id="my-listings-button" type="button" aria-label="${e('myListings')}" title="${e('myListings')}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12" y2="16"></line></svg></button></div>` : `
          <button class="bankid-button" id="bankid-button" type="button"><span class="bankid-mark">ID</span><span class="bankid-label">Logga in med BankID</span></button>
          <div class="auth-actions" id="auth-actions" hidden>
            <div class="inbox-wrap">
              <button class="icon-button inbox-button" id="inbox-button" type="button" aria-label="Inkorg" title="Inkorg" aria-expanded="false"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M4 7l8 6 8-6"></path></svg><span class="inbox-badge" id="inbox-badge">3</span></button>
              <div class="inbox-dropdown" id="inbox-dropdown" hidden>
                <p class="eyebrow">Inkorg</p>
                <div class="inbox-message"><strong>Erik Svensson</strong><span class="inbox-time">10:24</span><p>Hej! Är balkongen i söderläge på Kanalgatan 41C?</p></div>
                <div class="inbox-message"><strong>Maria Lindqvist</strong><span class="inbox-time">Igår</span><p>Vi vill gärna boka en visning av Strandvägen 7.</p></div>
                <div class="inbox-message"><strong>Köpanalys</strong><span class="inbox-time">Måndag</span><p>Din bytesannons har fått ett nytt intresseanmälan.</p></div>
              </div>
            </div>
            <button class="icon-button" id="my-listings-button" type="button" aria-label="${e('myListings')}" title="${e('myListings')}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12" y2="16"></line></svg></button>
            <button class="logout-button" id="logout-button" type="button">Logga ut</button>
          </div>
          `}
          <button class="icon-button" id="locate-button" title="${e('locate')}" aria-label="${e('locate')}">⌖</button>
        </div>
      </header>
      <section class="workspace">
        <button type="button" class="drawer-close" id="drawer-close" aria-label="${e('closeList')}">×</button>
        <aside class="sidebar" id="atlas-sidebar">
          <div class="sidebar-header"><div><p class="eyebrow">${e('eyebrow')}</p>${isPublic ? `<h2>${e('heading')}</h2>` : `<h1>${e('heading')}</h1>`}</div></div>
          <p class="intro">${e('intro')}</p>
          <div class="action-row"><button class="primary-button" id="add-button"><span>＋</span> ${e('create')}</button></div>
          <button type="button" class="list-heading" data-filter-section="sale" aria-pressed="true"><span class="heading-dot"></span><span>${e('kinds.sale')}</span><strong id="pin-count">${pins.length}</strong></button>
          <div class="pin-list" id="pin-list" data-filter-section="sale"></div>
          <button type="button" class="list-heading buyer-heading" data-filter-section="buyer" aria-pressed="true"><span class="heading-dot"></span><span>${e('kinds.buyer')}</span><strong id="buyer-count">${buyerPins.length}</strong></button>
          <div class="pin-list" id="buyer-list" data-filter-section="buyer"></div>
          <button type="button" class="list-heading exchange-heading" data-filter-section="exchange" aria-pressed="true"><span class="heading-dot"></span><span>${e('kinds.exchange')}</span><strong id="exchange-count">${exchangePins.length}</strong></button>
          <div class="pin-list" id="exchange-list" data-filter-section="exchange"></div>
          <div class="sidebar-footer"><div class="source-row"><span class="map-badge">●</span><span>${e('osmData')}</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">${e('about')}</a></div>${isPublic ? '' : '<small class="copyright">© 2026 Köpanalys. Org.nr 9811048793</small>'}</div>
        </aside>
        <div class="drawer-backdrop" id="drawer-backdrop"></div>
        <div class="drawer-edge" id="drawer-edge"></div>
        <div class="map-wrap"><div id="map"></div><button type="button" class="list-toggle" id="drawer-toggle" aria-label="${e('showList')}" aria-expanded="false" aria-controls="atlas-sidebar"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="9" y1="6" x2="20" y2="6"></line><line x1="9" y1="12" x2="20" y2="12"></line><line x1="9" y1="18" x2="20" y2="18"></line><circle cx="4.5" cy="6" r="1"></circle><circle cx="4.5" cy="12" r="1"></circle><circle cx="4.5" cy="18" r="1"></circle></svg></button><div class="map-hint" id="map-hint"><span>＋</span> ${e('hint')}</div><div class="zoom-control" id="zoom-control"><button id="zoom-in" aria-label="${e('zoomIn')}">＋</button><button id="zoom-out" aria-label="${e('zoomOut')}">−</button><button id="map-style-toggle" class="map-style-toggle" aria-label="${e('style.toSatellite')}" title="${e('style.satellite')}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(-45 12 12)"><rect x="2.5" y="9.5" width="6" height="5" rx="1.2"></rect><rect x="15.5" y="9.5" width="6" height="5" rx="1.2"></rect><rect x="9.5" y="9" width="5" height="6" rx="1.2"></rect><line x1="8.5" y1="12" x2="9.5" y2="12"></line><line x1="14.5" y1="12" x2="15.5" y2="12"></line></g></svg></button><button id="transit-toggle" class="transit-toggle" aria-label="${e('transit.show')}" title="${e('transit.title')}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="13" rx="4"></rect><line x1="6" y1="10" x2="18" y2="10"></line><circle cx="9.5" cy="13.2" r="0.6" fill="currentColor" stroke="none"></circle><circle cx="14.5" cy="13.2" r="0.6" fill="currentColor" stroke="none"></circle><line x1="8" y1="17" x2="6" y2="20"></line><line x1="16" y1="17" x2="18" y2="20"></line></svg></button></div><div class="map-legend" id="map-legend" role="group" aria-label="${e('filter')}"><button type="button" class="legend-item" data-filter-section="sale" aria-pressed="true"><span class="legend-dot"></span>${e('kinds.sale')}</button><button type="button" class="legend-item" data-filter-section="buyer" aria-pressed="true"><span class="legend-dot"></span>${e('kinds.buyer')}</button><button type="button" class="legend-item" data-filter-section="exchange" aria-pressed="true"><span class="legend-dot"></span>${e('kinds.exchange')}</button></div><aside class="detail-panel" id="detail-panel" hidden></aside></div>
      </section>
      <div class="modal-backdrop" id="modal-backdrop" hidden><form class="place-modal" id="place-form"><button type="button" class="modal-close" id="modal-close" aria-label="${e('close')}">×</button><p class="eyebrow">${e('form.eyebrow')}</p><h2 id="form-title">${e('form.titles.sale')}</h2><div class="pin-type-switch" role="tablist" aria-label="${e('form.pinType')}"><button type="button" class="type-option is-active" data-pin-kind="sale" role="tab" aria-selected="true">${e('kinds.sale')}</button><button type="button" class="type-option" data-pin-kind="buyer" role="tab" aria-selected="false">${e('kinds.buyer')}</button><button type="button" class="type-option" data-pin-kind="exchange" role="tab" aria-selected="false">${e('kinds.exchange')}</button></div><div class="field-grid"><label>${e('form.heading')}<input name="title" required maxlength="60" placeholder="${e('form.headingPlaceholder')}"></label><label id="note-label">${e('form.place.sale')}<span class="address-input"><input name="note" required maxlength="100" placeholder="${e('form.placePlaceholder')}"><button type="button" class="map-pick-button" data-pick-target="note" aria-label="${e('form.pickOnMap')}" title="${e('form.pickOnMap')}">⌖</button></span></label></div><div class="form-section" data-form-section="sale"><label>${e('form.saleMeta')}<input name="meta" maxlength="100" placeholder="${e('form.saleMetaPlaceholder')}"></label><div class="image-field"><div class="field-grid"><label>${e('form.imageLink')} <span>${e('form.optional')}</span><input name="image" type="url" placeholder="https://..."></label><label class="file-field">${e('form.imageUpload')} <span>${e('form.optional')}</span><input name="imageFile" type="file" accept="image/*" class="file-input"></label></div><div class="image-preview" hidden><img alt=""><button type="button" class="image-preview-remove" aria-label="${e('form.removeImage')}">×</button></div></div><label>${e('form.saleLink')} <span>${e('form.optional')}</span><input name="link" type="url" placeholder="https://www.hemnet.se/..."></label><label>${e('form.saleDescription')} <span>${e('form.optional')}</span><textarea name="details" maxlength="300" placeholder="${e('form.saleDescriptionPlaceholder')}"></textarea></label></div><div class="form-section" data-form-section="buyer" hidden><label>${e('form.buyerMeta')}<input name="meta" maxlength="120" placeholder="${e('form.buyerMetaPlaceholder')}"></label><div class="image-field"><div class="field-grid"><label>${e('form.imageLink')} <span>${e('form.optional')}</span><input name="image" type="url" placeholder="https://..."></label><label class="file-field">${e('form.imageUpload')} <span>${e('form.optional')}</span><input name="imageFile" type="file" accept="image/*" class="file-input"></label></div><div class="image-preview" hidden><img alt=""><button type="button" class="image-preview-remove" aria-label="${e('form.removeImage')}">×</button></div></div><label>${e('form.buyerMore')}<textarea name="details" maxlength="300" placeholder="${e('form.buyerMorePlaceholder')}"></textarea></label></div><div class="form-section" data-form-section="exchange" hidden><div class="field-grid"><label>${e('form.exchangeMeta')}<input name="meta" maxlength="120" placeholder="${e('form.exchangeMetaPlaceholder')}"></label><label>${e('form.exchangeWantsToLive')}<span class="address-input"><input name="toNote" required maxlength="100" placeholder="${e('form.exchangeWantsPlaceholder')}"><button type="button" class="map-pick-button" data-pick-target="toNote" aria-label="${e('form.pickOnMap')}" title="${e('form.pickOnMap')}">⌖</button></span></label></div><div class="image-field"><div class="field-grid"><label>${e('form.imageLink')} <span>${e('form.optional')}</span><input name="image" type="url" placeholder="https://..."></label><label class="file-field">${e('form.imageUpload')} <span>${e('form.optional')}</span><input name="imageFile" type="file" accept="image/*" class="file-input"></label></div><div class="image-preview" hidden><img alt=""><button type="button" class="image-preview-remove" aria-label="${e('form.removeImage')}">×</button></div></div><label>${e('form.exchangeInfo')}<textarea name="details" maxlength="300" placeholder="${e('form.exchangeInfoPlaceholder')}"></textarea></label></div><button class="primary-button form-submit" type="submit">${e('form.save')}</button></form></div>
      <div class="modal-backdrop" id="my-listings-backdrop" hidden><div class="place-modal my-listings-modal"><button type="button" class="modal-close" id="my-listings-close" aria-label="${e('close')}">×</button><p class="eyebrow">${e('mine.eyebrow')}</p><h2>${e('mine.heading')}</h2><div class="my-listings-list" id="my-listings-list"></div></div></div>
    </${shellTag}>
  `

  const map = L.map(root.querySelector<HTMLElement>('#map')!, { zoomControl: false })
  const swedenBounds = L.latLngBounds([[55.0, 10.5], [69.2, 24.2]])
  map.fitBounds(swedenBounds, { padding: [28, 28] })
  const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19, className: 'map-tiles-street' }).addTo(map)
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri', maxZoom: 19 })
  const transitLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', { attribution: 'Railway data &copy; <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a> contributors (CC-BY-SA)', maxZoom: 19, opacity: 0.9, zIndex: 650 })

  const pinIcon = L.divIcon({ className: 'custom-pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 34] })
  const buyerPinIcon = L.divIcon({ className: 'custom-pin custom-buyer-pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 34] })
  const exchangeFromIcon = L.divIcon({ className: 'custom-pin custom-exchange-pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 34] })
  const exchangeToIcon = L.divIcon({ className: 'custom-pin custom-exchange-pin custom-exchange-to', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 34] })
  const pendingPinIcon = L.divIcon({ className: 'pending-pin', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] })
  const pendingToPinIcon = L.divIcon({ className: 'pending-pin pending-pin-to', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] })
  const markers = new Map<number, L.Marker>()
  const buyerMarkers = new Map<number, L.Marker>()
  // The arc is the dashed route line; the casing is the wider white line drawn under it (its halo).
  const exchangeMarkers = new Map<number, { from: L.Marker; to: L.Marker; arc: L.Polyline; casing: L.Polyline }>()
  const list = root.querySelector<HTMLDivElement>('#pin-list')!
  const buyerList = root.querySelector<HTMLDivElement>('#buyer-list')!
  const exchangeList = root.querySelector<HTMLDivElement>('#exchange-list')!
  const detailPanel = root.querySelector<HTMLElement>('#detail-panel')!
  const mapHint = root.querySelector<HTMLElement>('#map-hint')!
  const searchForm = root.querySelector<HTMLFormElement>('#search-form')!
  const searchInput = root.querySelector<HTMLInputElement>('#search-input')!
  const searchSuggestions = root.querySelector<HTMLDataListElement>('#search-suggestions')!
  const modal = root.querySelector<HTMLDivElement>('#modal-backdrop')!
  const form = root.querySelector<HTMLFormElement>('#place-form')!
  // The demo sign-in, inbox and sign-out exist only in the admin portal.
  const bankidButton = root.querySelector<HTMLButtonElement>('#bankid-button')
  const authActions = root.querySelector<HTMLElement>('#auth-actions')!
  const inboxButton = root.querySelector<HTMLButtonElement>('#inbox-button')
  const inboxDropdown = root.querySelector<HTMLElement>('#inbox-dropdown')
  const logoutButton = root.querySelector<HTMLButtonElement>('#logout-button')
  const myListingsButton = root.querySelector<HTMLButtonElement>('#my-listings-button')!
  const myListingsBackdrop = root.querySelector<HTMLDivElement>('#my-listings-backdrop')!
  const myListingsList = root.querySelector<HTMLDivElement>('#my-listings-list')!
  const loginStorageKey = 'kopanalys-logged-in'
  let isLoggedIn = localStorage.getItem(loginStorageKey) === 'true'
  let editingPin: { kind: PinKind; id: number } | null = null
  let cameFromMyListings = false
  let pendingLocation: L.LatLng | null = null
  let pendingToLocation: L.LatLng | null = null
  let pickingTarget: 'note' | 'toNote' | null = null
  let pendingMarker: L.Marker | null = null
  let pendingToMarker: L.Marker | null = null
  let modalPinKind: PinKind = 'sale'
  let searchMarker: L.Marker | null = null
  let suggestionTimer: ReturnType<typeof setTimeout> | undefined
  let suggestionRequestId = 0
  const searchPinIcon = L.divIcon({ className: 'search-pin', html: '<span></span>', iconSize: [22, 30], iconAnchor: [11, 28] })

  // --- Phone layout: the listing pane is a drawer over the map ------------------------------------
  // The stylesheet makes the sidebar a drawer at this width ($map-bp-stacked in
  // styles/_variables.scss) - keep the number in step with it. It opens from the button in the
  // map's corner, by a swipe in from the left edge, or by dragging it; it closes on choosing a
  // listing, on the backdrop or ×, on Escape, or by swiping it back.
  const phoneQuery = window.matchMedia('(max-width: 700px)')
  const isPhone = () => phoneQuery.matches
  const shell = root.querySelector<HTMLElement>('.app-shell')!
  const sidebar = root.querySelector<HTMLElement>('#atlas-sidebar')!
  const drawerToggle = root.querySelector<HTMLButtonElement>('#drawer-toggle')!
  const drawerClose = root.querySelector<HTMLButtonElement>('#drawer-close')!
  const drawerBackdrop = root.querySelector<HTMLElement>('#drawer-backdrop')!
  const drawerEdge = root.querySelector<HTMLElement>('#drawer-edge')!
  const isDrawerOpen = () => shell.classList.contains('drawer-open')
  function setDrawer(open: boolean) {
    const wasOpen = isDrawerOpen()
    const next = open && isPhone()
    sidebar.removeAttribute('style')
    drawerBackdrop.removeAttribute('style')
    shell.classList.toggle('drawer-open', next)
    drawerToggle.setAttribute('aria-expanded', String(next))
    if (next && !wasOpen) drawerClose.focus({ preventScroll: true })
    else if (!next && wasOpen && (sidebar.contains(document.activeElement) || document.activeElement === drawerClose)) drawerToggle.focus({ preventScroll: true })
  }
  const closeDrawer = () => setDrawer(false)

  // Follows the finger while it drags, then settles open or closed (a third of the way decides).
  let drag: { el: HTMLElement; id: number; x: number; y: number; width: number; opening: boolean; moving: boolean; shift: number } | null = null
  let ignoreClickUntil = 0
  function attachDrag(el: HTMLElement, opening: boolean) {
    el.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch' || !isPhone() || drag) return
      drag = { el, id: event.pointerId, x: event.clientX, y: event.clientY, width: sidebar.offsetWidth, opening, moving: false, shift: opening ? -sidebar.offsetWidth : 0 }
    })
    el.addEventListener('pointermove', (event) => {
      if (!drag || drag.el !== el || event.pointerId !== drag.id) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (!drag.moving) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        // Mostly vertical (the list scrolls) or the wrong way: not a drawer gesture.
        if (Math.abs(dy) > Math.abs(dx) || (opening ? dx < 0 : dx > 0)) { drag = null; return }
        drag.moving = true
        try { el.setPointerCapture(event.pointerId) } catch { /* the pointer is already gone: nothing to capture */ }
        sidebar.style.transition = 'none'
        sidebar.style.visibility = 'visible'
        drawerBackdrop.style.transition = 'none'
      }
      drag.shift = Math.max(-drag.width, Math.min(0, (opening ? -drag.width : 0) + dx))
      sidebar.style.transform = `translateX(${drag.shift}px)`
      drawerBackdrop.style.opacity = String(1 + drag.shift / drag.width)
    })
    const finish = (event: PointerEvent) => {
      if (!drag || drag.el !== el || event.pointerId !== drag.id) return
      const { moving, shift, width } = drag
      drag = null
      if (!moving) return
      ignoreClickUntil = Date.now() + 350
      setDrawer(1 + shift / width > (opening ? 0.3 : 0.7))
    }
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
  }
  attachDrag(drawerEdge, true)
  attachDrag(sidebar, false)
  attachDrag(drawerBackdrop, false)
  drawerToggle.addEventListener('click', () => setDrawer(!isDrawerOpen()))
  drawerClose.addEventListener('click', closeDrawer)
  drawerBackdrop.addEventListener('click', () => { if (Date.now() > ignoreClickUntil) closeDrawer() })
  phoneQuery.addEventListener('change', closeDrawer)

  // On a phone the detail panel is a sheet over the lower half of the map, so a pin that is
  // brought into focus goes in the upper half instead of the middle.
  function flyToPin(location: L.LatLngExpression, zoom: number, duration: number) {
    if (!isPhone()) { map.flyTo(location, zoom, { duration }); return }
    const lowered = map.project(L.latLng(location), zoom).add([0, map.getSize().y * 0.24])
    map.flyTo(map.unproject(lowered, zoom), zoom, { duration })
  }

  function selectPin(pin: SavedPin, kind: 'sale' | 'buyer', redraw = false) {
    if (!redraw) {
      closeDrawer()
      setArcHighlight(null)
      setSelectedMarker(`${kind}-${pin.id}`)
      flyToPin([pin.lat, pin.lng], 15, 0.8)
    }
    const key = `${kind}-${pin.id}`
    const labels: Record<'sale' | 'buyer', string> = { sale: t('kinds.sale'), buyer: t('kinds.buyer') }
    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`
    const contactLink = `mailto:kontakt@kopanalys.se?subject=${encodeURIComponent(t('detail.contactSubject', { title: pin.title }))}`
    const hasPhoto = kind === 'sale' || Boolean(pin.image)
    const tag = `<span class="detail-tag${kind === 'buyer' ? ' detail-tag-buyer' : ''}">${labels[kind]}</span>`
    const photoBlock = hasPhoto ? `<div class="detail-photo-wrap"><img class="detail-photo" src="${esc(safeImage(pin.image) ?? DEFAULT_LISTING_PHOTO)}" alt="${e('detail.photoOf', { title: pin.title })}">${tag}</div>` : ''
    const bodyOpen = hasPhoto ? '<div class="detail-body">' : '<div class="detail-body detail-body-compact">'
    const inlineTag = hasPhoto ? '' : tag
    const actionBlock = kind === 'sale'
      ? `<a class="detail-link" href="${esc(safeHref(pin.link) ?? 'https://www.hemnet.se/')}" target="_blank" rel="noreferrer">${e('detail.viewListing')} <span>↗</span></a>`
      : `<div class="detail-contact"><span class="contact-dot"></span><span>${e('detail.requestActive')}</span></div><a class="detail-contact-link" href="${contactLink}">${e('detail.contact')} <span>↗</span></a>`
    const createAnalysisBlock = kind === 'sale' ? `<button type="button" class="detail-create-analysis">${e('detail.createAnalysis')}</button>` : ''
    const panelContent = `${detailClose(t('close'))}${photoBlock}${bodyOpen}${inlineTag}<h2>${esc(shown(pin.title, key))}</h2><p class="detail-note">${esc(shown(pin.note, key))}</p><p class="detail-meta">${esc(shown(pin.meta, key) ?? (kind === 'sale' ? t('detail.saleMeta') : t('detail.requestMeta')))}</p><p class="detail-description">${esc(shown(pin.details, key) ?? (kind === 'sale' ? t('detail.saleDetails') : t('detail.requestDetails')))}</p>${translationNote(key, [pin.title, pin.note, pin.meta, pin.details])}${actionBlock}<a class="detail-map-link" href="${googleMapsLink}" target="_blank" rel="noreferrer">${e('detail.openInGoogleMaps')} <span>↗</span></a>${createAnalysisBlock}</div>`
    detailPanel.innerHTML = panelContent
    detailPanel.hidden = false
    detailPanel.querySelector('#detail-close')?.addEventListener('click', closeDetail)
    detailPanel.querySelector('.detail-translation-toggle')?.addEventListener('click', () => { if (showOriginal.has(key)) showOriginal.delete(key); else showOriginal.add(key); selectPin(pin, kind, true) })
    if (options.onCreateAnalysis) detailPanel.querySelector('.detail-create-analysis')?.addEventListener('click', options.onCreateAnalysis)
  }
  function closeDetail() { detailPanel.hidden = true; setArcHighlight(null); setSelectedMarker(null) }
  /** "Translated automatically. Show original": under the description of a listing whose wording was translated. */
  function translationNote(key: string, texts: Array<string | undefined>): string {
    if (!hasTranslation(texts)) return ''
    return `<p class="detail-translation">${e('detail.translated')} <button type="button" class="detail-translation-toggle">${showOriginal.has(key) ? e('detail.showTranslation') : e('detail.showOriginal')}</button></p>`
  }
  function isFilterVisible(kind: PinKind) { return visibleKinds[kind] }
  function toggleKind(kind: PinKind) { visibleKinds[kind] = !visibleKinds[kind]; renderPins() }

  function buildArc(fromLat: number, fromLng: number, toLat: number, toLng: number, segments = 48): [number, number][] {
    const dx = toLng - fromLng
    const dy = toLat - fromLat
    const dist = Math.hypot(dx, dy) || 1
    const bow = dist * 0.18
    const controlLat = (fromLat + toLat) / 2 + (dx / dist) * bow
    const controlLng = (fromLng + toLng) / 2 - (dy / dist) * bow
    const points: [number, number][] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const lat = (1 - t) ** 2 * fromLat + 2 * (1 - t) * t * controlLat + t ** 2 * toLat
      const lng = (1 - t) ** 2 * fromLng + 2 * (1 - t) * t * controlLng + t ** 2 * toLng
      points.push([lat, lng])
    }
    return points
  }

  let selectedPinKey: string | null = null
  function setSelectedMarker(key: string | null) {
    selectedPinKey = key
    markers.forEach((marker, id) => marker.getElement()?.classList.toggle('pin-selected', key === `sale-${id}`))
    buyerMarkers.forEach((marker, id) => marker.getElement()?.classList.toggle('pin-selected', key === `buyer-${id}`))
    exchangeMarkers.forEach((group, id) => {
      const active = key === `exchange-${id}`
      group.from.getElement()?.classList.toggle('pin-selected', active)
      group.to.getElement()?.classList.toggle('pin-selected', active)
    })
    root.querySelectorAll<HTMLElement>('.pin-item.is-selected').forEach((item) => item.classList.remove('is-selected'))
    if (!key) return
    const separatorIndex = key.indexOf('-')
    const kind = key.slice(0, separatorIndex)
    const id = key.slice(separatorIndex + 1)
    const container = kind === 'sale' ? list : kind === 'buyer' ? buyerList : exchangeList
    const item = container.querySelector<HTMLElement>(`.pin-item[data-id="${id}"]`)
    if (item) {
      item.classList.add('is-selected')
      // Scroll the sidebar itself and nothing else: Element.scrollIntoView would also move the page,
      // and the workspace clipping the closed drawer, to reach an item that is off screen.
      const box = sidebar.getBoundingClientRect()
      const row = item.getBoundingClientRect()
      if (row.top < box.top) sidebar.scrollBy({ top: row.top - box.top - 8, behavior: 'smooth' })
      else if (row.bottom > box.bottom) sidebar.scrollBy({ top: row.bottom - box.bottom + 8, behavior: 'smooth' })
    }
  }

  function setArcHighlight(id: number | null) {
    exchangeMarkers.forEach((group, groupId) => {
      const active = groupId === id
      // The others fade back while one is highlighted; the casing is always a little wider than its line.
      const faded = id !== null && !active
      group.casing.setStyle({ weight: active ? 10 : 7, opacity: faded ? 0.2 : 0.9 })
      group.arc.setStyle({ weight: active ? 6 : 3.5, opacity: faded ? 0.25 : 1 })
      group.arc.getElement()?.classList.toggle('exchange-arc-active', active)
      if (active) { group.casing.bringToFront(); group.arc.bringToFront() }
    })
  }

  function focusExchangeStop(pin: ExchangePin, which: 'from' | 'to') {
    const location = pin[which]
    setArcHighlight(pin.id)
    const target: L.LatLngExpression = [location.lat, location.lng]
    if (!isPhone() && map.getZoom() === 15) map.panTo(target, { duration: 0.6 })
    else flyToPin(target, 15, 0.6)
    const group = exchangeMarkers.get(pin.id)
    ;(which === 'from' ? group?.from : group?.to)?.openTooltip()
    detailPanel.querySelectorAll<HTMLButtonElement>('.exchange-stop').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === which))
  }

  function selectExchangePin(pin: ExchangePin, redraw = false) {
    const key = `exchange-${pin.id}`
    if (!redraw) {
      closeDrawer()
      setArcHighlight(pin.id)
      setSelectedMarker(key)
      const bounds = L.latLngBounds([[pin.from.lat, pin.from.lng], [pin.to.lat, pin.to.lng]])
      // Both ends stay in the upper half of the map on a phone, above the detail sheet.
      const framing: L.FitBoundsOptions = isPhone()
        ? { paddingTopLeft: [40, 56], paddingBottomRight: [40, Math.round(map.getSize().y * 0.5) + 24] }
        : { padding: [90, 90] }
      map.flyToBounds(bounds, { ...framing, maxZoom: 13, duration: 0.8 })
    }
    const fromMapsLink = `https://www.google.com/maps/search/?api=1&query=${pin.from.lat},${pin.from.lng}`
    const toMapsLink = `https://www.google.com/maps/search/?api=1&query=${pin.to.lat},${pin.to.lng}`
    const contactLink = `mailto:kontakt@kopanalys.se?subject=${encodeURIComponent(t('detail.contactSubject', { title: pin.title }))}`
    const tag = `<span class="detail-tag detail-tag-exchange">${e('kinds.exchange')}</span>`
    const photoBlock = pin.image ? `<div class="detail-photo-wrap"><img class="detail-photo" src="${esc(safeImage(pin.image))}" alt="${e('detail.photoOf', { title: pin.title })}">${tag}</div>` : ''
    const bodyOpen = pin.image ? '<div class="detail-body">' : '<div class="detail-body detail-body-compact">'
    const inlineTag = pin.image ? '' : tag
    detailPanel.innerHTML = `${detailClose(t('close'))}${photoBlock}${bodyOpen}${inlineTag}<h2>${esc(shown(pin.title, key))}</h2><div class="exchange-route"><button type="button" class="exchange-stop" data-nav="from"><span class="exchange-dot exchange-dot-from"></span><div><small>${e('detail.livesNow')}</small><strong>${esc(shown(pin.from.note, key))}</strong></div></button><div class="exchange-route-arrow">→</div><button type="button" class="exchange-stop" data-nav="to"><span class="exchange-dot exchange-dot-to"></span><div><small>${e('detail.wantsToLive')}</small><strong>${esc(shown(pin.to.note, key))}</strong></div></button></div><p class="detail-meta">${esc(shown(pin.meta, key))}</p><p class="detail-description">${esc(shown(pin.details, key) ?? t('detail.requestDetails'))}</p>${translationNote(key, [pin.title, pin.from.note, pin.to.note, pin.meta, pin.details])}<div class="detail-contact"><span class="contact-dot"></span><span>${e('detail.requestActive')}</span></div><a class="detail-contact-link" href="${contactLink}">${e('detail.contact')} <span>↗</span></a><a class="detail-map-link" href="${fromMapsLink}" target="_blank" rel="noreferrer">${e('detail.currentPlace')} <span>↗</span></a><a class="detail-map-link" href="${toMapsLink}" target="_blank" rel="noreferrer">${e('detail.wantedPlace')} <span>↗</span></a></div>`
    detailPanel.hidden = false
    detailPanel.querySelector('#detail-close')?.addEventListener('click', closeDetail)
    detailPanel.querySelector('[data-nav="from"]')?.addEventListener('click', () => focusExchangeStop(pin, 'from'))
    detailPanel.querySelector('[data-nav="to"]')?.addEventListener('click', () => focusExchangeStop(pin, 'to'))
    detailPanel.querySelector('.detail-translation-toggle')?.addEventListener('click', () => { if (showOriginal.has(key)) showOriginal.delete(key); else showOriginal.add(key); selectExchangePin(pin, true) })
  }

  function downscaleImage(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error('Kunde inte läsa filen'))
      reader.onload = () => {
        const img = new Image()
        img.onerror = () => reject(new Error('Kunde inte läsa bilden'))
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
          const width = Math.round(img.width * scale)
          const height = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) { resolve(reader.result as string); return }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  function resetImagePreviews() {
    form.querySelectorAll<HTMLInputElement>('input[name="imageFile"]').forEach((input) => { input.value = '' })
    form.querySelectorAll<HTMLElement>('.image-preview').forEach((preview) => { preview.hidden = true; const img = preview.querySelector('img'); if (img) img.src = '' })
  }

  async function handleImageFileChange(input: HTMLInputElement) {
    const file = input.files?.[0]
    const preview = input.closest('.image-field')?.querySelector<HTMLElement>('.image-preview')
    const img = preview?.querySelector('img')
    if (!file) { if (preview) preview.hidden = true; return }
    try {
      const dataUrl = await downscaleImage(file)
      if (img) img.src = dataUrl
      if (preview) preview.hidden = false
    } catch {
      input.value = ''
    }
  }

  function getFormImage(activeSection: Element | null): string {
    const preview = activeSection?.querySelector<HTMLElement>('.image-preview')
    const previewImg = preview?.querySelector('img')
    if (preview && !preview.hidden && previewImg?.src) return previewImg.src
    const urlInput = activeSection?.querySelector<HTMLInputElement>('input[name="image"]')
    return urlInput?.value.trim() || ''
  }

  async function geocodeInSweden(query: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': options.locale } })
      if (!response.ok) return null
      const results = await response.json() as Array<{ lat: string; lon: string }>
      const result = results[0]
      return result ? { lat: Number(result.lat), lng: Number(result.lon) } : null
    } catch { return null }
  }

  async function reverseGeocodeInSweden(lat: number, lng: number): Promise<string | null> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': options.locale } })
      if (!response.ok) return null
      const result = await response.json() as { display_name?: string; address?: Record<string, string> }
      const address = result.address
      if (address) {
        const primary = address.road || address.suburb || address.neighbourhood || address.hamlet || address.village
        const secondary = address.city || address.town || address.municipality || address.county
        const short = [primary, secondary].filter(Boolean).join(', ')
        if (short) return short
      }
      return result.display_name ?? null
    } catch { return null }
  }

  async function searchMap(query: string) {
    const normalizedQuery = query.trim().toLocaleLowerCase('sv-SE')
    if (!normalizedQuery) return
    closeDrawer()
    const saleIndex = pins.findIndex((pin) => `${pin.title} ${pin.note} ${pin.details ?? ''}`.toLocaleLowerCase('sv-SE').includes(normalizedQuery))
    if (saleIndex >= 0) { selectPin(pins[saleIndex], 'sale'); return }
    const buyerIndex = buyerPins.findIndex((pin) => `${pin.title} ${pin.note} ${pin.details ?? ''}`.toLocaleLowerCase('sv-SE').includes(normalizedQuery))
    if (buyerIndex >= 0) { selectPin(buyerPins[buyerIndex], 'buyer'); return }
    const exchangeMatch = exchangePins.find((pin) => `${pin.title} ${pin.from.note} ${pin.to.note} ${pin.details ?? ''}`.toLocaleLowerCase('sv-SE').includes(normalizedQuery))
    if (exchangeMatch) { selectExchangePin(exchangeMatch); return }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': options.locale } })
      if (!response.ok) throw new Error('Geocoding request failed')
      const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>
      const result = results[0]
      if (!result) {
        return
      }
      const location: L.LatLngExpression = [Number(result.lat), Number(result.lon)]
      map.flyTo(location, 13, { duration: 0.8 })
      searchMarker?.remove()
      searchMarker = L.marker(location, { icon: searchPinIcon }).addTo(map).bindTooltip(esc(result.display_name), { direction: 'top', offset: [0, -24] }).openTooltip()
    } catch { return }
  }

  function updatePinSuggestions(query: string) {
    const normalizedQuery = query.trim().toLocaleLowerCase('sv-SE')
    const directLabels = [...pins, ...buyerPins].filter((pin) => `${pin.title} ${pin.note}`.toLocaleLowerCase('sv-SE').includes(normalizedQuery)).flatMap((pin) => [pin.title, pin.note])
    const exchangeLabels = exchangePins.filter((pin) => `${pin.title} ${pin.from.note} ${pin.to.note}`.toLocaleLowerCase('sv-SE').includes(normalizedQuery)).flatMap((pin) => [pin.title, pin.from.note, pin.to.note])
    const uniqueLabels = new Set([...directLabels, ...exchangeLabels])
    searchSuggestions.innerHTML = [...uniqueLabels].map((label) => `<option value="${esc(label)}"></option>`).join('')
  }

  function updateLocationSuggestions(query: string) {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) return
    if (suggestionTimer) clearTimeout(suggestionTimer)
    const requestId = ++suggestionRequestId
    suggestionTimer = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=se&q=${encodeURIComponent(trimmedQuery)}`, { headers: { 'Accept-Language': options.locale } })
        if (!response.ok || requestId !== suggestionRequestId) return
        const results = await response.json() as Array<{ display_name: string }>
        const existingLabels = new Set(Array.from(searchSuggestions.options).map((option) => option.value))
        results.forEach((result) => { if (!existingLabels.has(result.display_name)) searchSuggestions.append(new Option(result.display_name)) })
      } catch { return }
    }, 300)
  }

  function thumbMarkup(image: string | undefined, number: number): string {
    return `<span class="pin-thumb">${safeImage(image) ? `<img src="${esc(safeImage(image))}" alt="" loading="lazy">` : '<span class="pin-thumb-fallback"></span>'}<span class="pin-number">${number}</span></span>`
  }
  function savePins() { localStorage.setItem(storageKey, JSON.stringify(pins)) }
  function saveBuyerPins() { localStorage.setItem(buyerStorageKey, JSON.stringify(buyerPins)) }
  function saveExchangePins() { localStorage.setItem(exchangeStorageKey, JSON.stringify(exchangePins)) }
  function renderPins() {
    markers.forEach((marker) => marker.remove())
    markers.clear()
    buyerMarkers.forEach((marker) => marker.remove())
    buyerMarkers.clear()
    exchangeMarkers.forEach((group) => { group.from.remove(); group.to.remove(); group.arc.remove(); group.casing.remove() })
    exchangeMarkers.clear()
    root.querySelectorAll<HTMLElement>('.pin-list[data-filter-section]').forEach((section) => { section.hidden = !visibleKinds[section.dataset.filterSection as PinKind] })
    root.querySelectorAll<HTMLButtonElement>('.list-heading[data-filter-section], .legend-item[data-filter-section]').forEach((toggle) => {
      const active = visibleKinds[toggle.dataset.filterSection as PinKind]
      toggle.classList.toggle('is-off', !active)
      toggle.setAttribute('aria-pressed', String(active))
    })
    list.innerHTML = pins.length ? pins.map((pin, index) => `<button class="pin-item" data-id="${pin.id}">${thumbMarkup(pin.image, index + 1)}<span class="pin-item-text"><strong>${esc(txt(pin.title))}</strong><small>${esc(pin.note ? txt(pin.note) : `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`)}</small></span><span class="item-arrow">›</span></button>`).join('') : `<div class="empty-state">${e('empty.sale')}<br>${e('empty.saleHint')}</div>`
    buyerList.innerHTML = buyerPins.length ? buyerPins.map((pin, index) => `<button class="pin-item buyer-item" data-id="${pin.id}">${thumbMarkup(pin.image, index + 1)}<span class="pin-item-text"><strong>${esc(txt(pin.title))}</strong><small>${esc(pin.note ? txt(pin.note) : `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`)}</small></span><span class="item-arrow">›</span></button>`).join('') : `<div class="empty-state">${e('empty.buyer')}</div>`
    exchangeList.innerHTML = exchangePins.length ? exchangePins.map((pin, index) => `<button class="pin-item exchange-item" data-id="${pin.id}">${thumbMarkup(pin.image, index + 1)}<span class="pin-item-text"><strong>${esc(txt(pin.title))}</strong><small>${esc(txt(pin.from.note))} → ${esc(txt(pin.to.note))}</small></span><span class="item-arrow">›</span></button>`).join('') : `<div class="empty-state">${e('empty.exchange')}</div>`
    root.querySelector('#pin-count')!.textContent = String(pins.length)
    root.querySelector('#buyer-count')!.textContent = String(buyerPins.length)
    root.querySelector('#exchange-count')!.textContent = String(exchangePins.length)
    if (isFilterVisible('sale')) pins.forEach((pin, index) => { const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon }).addTo(map).bindTooltip(`${index + 1}. ${esc(txt(pin.title))}`, { direction: 'top', offset: [0, -28] }).on('click', () => selectPin(pin, 'sale')); markers.set(pin.id, marker) })
    if (isFilterVisible('buyer')) buyerPins.forEach((pin, index) => { const marker = L.marker([pin.lat, pin.lng], { icon: buyerPinIcon }).addTo(map).bindTooltip(e('tooltips.buyer', { n: index + 1, title: txt(pin.title) }), { direction: 'top', offset: [0, -28] }).on('click', () => selectPin(pin, 'buyer')); buyerMarkers.set(pin.id, marker) })
    if (isFilterVisible('exchange')) exchangePins.forEach((pin, index) => {
      const path = buildArc(pin.from.lat, pin.from.lng, pin.to.lat, pin.to.lng)
      // Added first, so it lies under the arc. Colours are the stylesheet's (see .exchange-arc in the workspace mixin).
      const casing = L.polyline(path, { className: 'exchange-arc-casing', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map)
      // dashArray: 9 + 8 = the 17 px period the stylesheet's flow animation loops over
      const arc = L.polyline(path, { className: 'exchange-arc', weight: 3.5, opacity: 1, dashArray: '9 8', lineCap: 'butt' }).addTo(map)
      const fromMarker = L.marker([pin.from.lat, pin.from.lng], { icon: exchangeFromIcon }).addTo(map).bindTooltip(e('tooltips.exchange', { n: index + 1, title: txt(pin.title) }), { direction: 'top', offset: [0, -28] }).on('click', () => selectExchangePin(pin))
      const toMarker = L.marker([pin.to.lat, pin.to.lng], { icon: exchangeToIcon }).addTo(map).bindTooltip(e('tooltips.exchangeTo', { n: index + 1, place: txt(pin.to.note) }), { direction: 'top', offset: [0, -28] }).on('click', () => selectExchangePin(pin))
      exchangeMarkers.set(pin.id, { from: fromMarker, to: toMarker, arc, casing })
    })
    list.querySelectorAll<HTMLButtonElement>('.pin-item').forEach((item) => item.addEventListener('click', () => { const index = pins.findIndex((candidate) => candidate.id === Number(item.dataset.id)); if (index >= 0) selectPin(pins[index], 'sale') }))
    buyerList.querySelectorAll<HTMLButtonElement>('.pin-item').forEach((item) => item.addEventListener('click', () => { const index = buyerPins.findIndex((candidate) => candidate.id === Number(item.dataset.id)); if (index >= 0) selectPin(buyerPins[index], 'buyer') }))
    exchangeList.querySelectorAll<HTMLButtonElement>('.pin-item').forEach((item) => item.addEventListener('click', () => { const pin = exchangePins.find((candidate) => candidate.id === Number(item.dataset.id)); if (pin) selectExchangePin(pin) }))
    setSelectedMarker(selectedPinKey)
  }
  function setModalPinKind(kind: PinKind) {
    modalPinKind = kind
    const titles: Record<PinKind, string> = { sale: t('form.titles.sale'), buyer: t('form.titles.buyer'), exchange: t('form.titles.exchange') }
    root.querySelector('#form-title')!.textContent = titles[kind]
    form.querySelectorAll<HTMLButtonElement>('.type-option').forEach((option) => { const active = option.dataset.pinKind === kind; option.classList.toggle('is-active', active); option.setAttribute('aria-selected', String(active)) })
    form.querySelectorAll<HTMLElement>('[data-form-section]').forEach((section) => { const active = section.dataset.formSection === kind; section.hidden = !active; section.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((control) => { control.disabled = !active }) })
    const noteLabel = root.querySelector('#note-label')!
    noteLabel.firstChild!.textContent = kind === 'sale' ? t('form.place.sale') : kind === 'buyer' ? t('form.place.buyer') : t('form.place.exchange')
  }
  function setPendingMarker(which: 'note' | 'toNote', latlng: L.LatLng) {
    if (which === 'note') {
      if (pendingMarker) pendingMarker.setLatLng(latlng)
      else pendingMarker = L.marker(latlng, { icon: pendingPinIcon, interactive: false, zIndexOffset: 900 }).addTo(map)
    } else {
      if (pendingToMarker) pendingToMarker.setLatLng(latlng)
      else pendingToMarker = L.marker(latlng, { icon: pendingToPinIcon, interactive: false, zIndexOffset: 900 }).addTo(map)
    }
  }
  function clearPendingMarkers() {
    pendingMarker?.remove(); pendingMarker = null
    pendingToMarker?.remove(); pendingToMarker = null
  }

  const defaultMapHintHTML = mapHint.innerHTML
  function startPicking(target: 'note' | 'toNote') {
    pickingTarget = target
    modal.hidden = true
    mapHint.innerHTML = `<span>⌖</span> ${e('hintPick')}`
    form.querySelectorAll<HTMLButtonElement>('.map-pick-button').forEach((btn) => btn.classList.toggle('is-picking', btn.dataset.pickTarget === target))
  }
  function stopPicking() {
    pickingTarget = null
    mapHint.innerHTML = defaultMapHintHTML
    form.querySelectorAll<HTMLButtonElement>('.map-pick-button').forEach((btn) => btn.classList.remove('is-picking'))
  }
  async function applyPickedLocation(target: 'note' | 'toNote', latlng: L.LatLng) {
    stopPicking()
    modal.hidden = false
    if (target === 'note') pendingLocation = latlng
    else pendingToLocation = latlng
    setPendingMarker(target, latlng)
    const input = form.querySelector<HTMLInputElement>(`[name="${target}"]`)
    if (!input) return
    const originalPlaceholder = input.placeholder
    input.value = ''
    input.placeholder = t('form.fetchingAddress')
    const address = await reverseGeocodeInSweden(latlng.lat, latlng.lng)
    input.value = address ?? ''
    input.placeholder = originalPlaceholder
  }
  async function syncFieldToMap(which: 'note' | 'toNote', input: HTMLInputElement) {
    const query = input.value.trim()
    if (!query) return
    const result = await geocodeInSweden(query)
    if (!result || input.value.trim() !== query) return
    const latlng = L.latLng(result.lat, result.lng)
    if (which === 'note') pendingLocation = latlng
    else pendingToLocation = latlng
    setPendingMarker(which, latlng)
  }

  async function openModal(location: L.LatLng, kind: PinKind = 'sale') {
    pendingLocation = location
    pendingToLocation = null
    form.reset()
    resetImagePreviews()
    setModalPinKind(kind)
    modal.hidden = false
    setPendingMarker('note', location)
    const noteInput = form.elements.namedItem('note') as HTMLInputElement
    noteInput.focus()
    const originalPlaceholder = noteInput.placeholder
    noteInput.placeholder = t('form.fetchingAddress')
    const address = await reverseGeocodeInSweden(location.lat, location.lng)
    if (pendingLocation === location) {
      noteInput.value = address ?? ''
      noteInput.placeholder = originalPlaceholder
    }
  }
  function closeModal() {
    modal.hidden = true
    form.reset()
    resetImagePreviews()
    pendingLocation = null
    pendingToLocation = null
    clearPendingMarkers()
    stopPicking()
    editingPin = null
    form.querySelectorAll<HTMLButtonElement>('.type-option').forEach((option) => { option.disabled = false })
    form.querySelector<HTMLButtonElement>('.form-submit')!.textContent = t('form.save')
    if (cameFromMyListings) { cameFromMyListings = false; renderMyListingsDialog(); myListingsBackdrop.hidden = false }
  }

  function upsertInto<T extends { id: number }>(array: T[], id: number, pin: T, isEditing: boolean) {
    if (isEditing) {
      const index = array.findIndex((candidate) => candidate.id === id)
      if (index >= 0) { array[index] = pin; return }
    }
    array.push(pin)
  }

  function myListingThumb(image: string | undefined): string {
    return `<span class="pin-thumb">${safeImage(image) ? `<img src="${esc(safeImage(image))}" alt="" loading="lazy">` : '<span class="pin-thumb-fallback"></span>'}</span>`
  }

  function myListingRow(kind: PinKind, id: number, image: string | undefined, title: string, note: string, tagClass: string, tagLabel: string): string {
    return `<div class="my-listing-row">${myListingThumb(image)}<span class="pin-item-text"><strong>${esc(title)}</strong><small>${esc(note)}</small></span><span class="my-listing-actions"><span class="my-listing-tag${tagClass}">${tagLabel}</span><button type="button" class="my-listing-edit" data-kind="${kind}" data-id="${id}">${e('mine.edit')}</button><button type="button" class="my-listing-delete" data-kind="${kind}" data-id="${id}">${e('mine.remove')}</button></span></div>`
  }
  function renderMyListingsDialog() {
    const rows: string[] = []
    pins.filter((pin) => pin.isMine).forEach((pin) => rows.push(myListingRow('sale', pin.id, pin.image, pin.title, pin.note, '', e('kinds.sale'))))
    buyerPins.filter((pin) => pin.isMine).forEach((pin) => rows.push(myListingRow('buyer', pin.id, pin.image, pin.title, pin.note, ' my-listing-tag-buyer', e('kinds.buyer'))))
    exchangePins.filter((pin) => pin.isMine).forEach((pin) => rows.push(myListingRow('exchange', pin.id, pin.image, pin.title, `${pin.from.note} → ${pin.to.note}`, ' my-listing-tag-exchange', e('kinds.exchange'))))
    myListingsList.innerHTML = rows.length ? rows.join('') : `<div class="empty-state">${e('mine.empty')}<br>${e('mine.emptyHint')}</div>`
  }

  function openEditModal(kind: PinKind, id: number) {
    const pin = kind === 'sale' ? pins.find((p) => p.id === id) : kind === 'buyer' ? buyerPins.find((p) => p.id === id) : exchangePins.find((p) => p.id === id)
    if (!pin) return
    cameFromMyListings = !myListingsBackdrop.hidden
    myListingsBackdrop.hidden = true
    editingPin = { kind, id }
    form.reset()
    resetImagePreviews()
    setModalPinKind(kind)
    modal.hidden = false
    form.querySelectorAll<HTMLButtonElement>('.type-option').forEach((option) => { option.disabled = true })
    root.querySelector('#form-title')!.textContent = t('form.titles.edit')
    form.querySelector<HTMLButtonElement>('.form-submit')!.textContent = t('form.saveChanges')
    const activeSection = form.querySelector<HTMLElement>(`[data-form-section="${kind}"]`)!
    ;(form.elements.namedItem('title') as HTMLInputElement).value = pin.title
    activeSection.querySelector<HTMLInputElement>('input[name="meta"]')!.value = pin.meta ?? ''
    activeSection.querySelector<HTMLTextAreaElement>('textarea[name="details"]')!.value = pin.details ?? ''
    if (kind === 'exchange') {
      const exchangePin = pin as ExchangePin
      ;(form.elements.namedItem('note') as HTMLInputElement).value = exchangePin.from.note
      ;(form.elements.namedItem('toNote') as HTMLInputElement).value = exchangePin.to.note
      pendingLocation = L.latLng(exchangePin.from.lat, exchangePin.from.lng)
      pendingToLocation = L.latLng(exchangePin.to.lat, exchangePin.to.lng)
      setPendingMarker('note', pendingLocation)
      setPendingMarker('toNote', pendingToLocation)
    } else {
      const savedPin = pin as SavedPin
      ;(form.elements.namedItem('note') as HTMLInputElement).value = savedPin.note
      pendingLocation = L.latLng(savedPin.lat, savedPin.lng)
      pendingToLocation = null
      setPendingMarker('note', pendingLocation)
      if (kind === 'sale') (form.elements.namedItem('link') as HTMLInputElement).value = savedPin.link ?? ''
    }
    if (pin.image) {
      const preview = activeSection.querySelector<HTMLElement>('.image-preview')!
      const img = preview.querySelector('img')!
      img.src = pin.image
      preview.hidden = false
    }
    map.flyTo(pendingLocation, 14, { duration: 0.6 })
  }

  function deleteMyPin(kind: PinKind, id: number) {
    if (!confirm(t('mine.confirmRemove'))) return
    if (kind === 'sale') { pins = pins.filter((p) => p.id !== id); savePins() }
    else if (kind === 'buyer') { buyerPins = buyerPins.filter((p) => p.id !== id); saveBuyerPins() }
    else { exchangePins = exchangePins.filter((p) => p.id !== id); saveExchangePins() }
    if (selectedPinKey === `${kind}-${id}`) closeDetail()
    renderPins()
    renderMyListingsDialog()
  }

  function applyAuthState() {
    if (isPublic) return
    if (bankidButton) bankidButton.hidden = isLoggedIn
    authActions.hidden = !isLoggedIn
    if (!isLoggedIn && inboxDropdown) inboxDropdown.hidden = true
  }
  function login() { isLoggedIn = true; localStorage.setItem(loginStorageKey, 'true'); applyAuthState() }
  function logout() { isLoggedIn = false; localStorage.setItem(loginStorageKey, 'false'); applyAuthState(); myListingsBackdrop.hidden = true }

  map.on('click', (event) => { if (pickingTarget) { void applyPickedLocation(pickingTarget, event.latlng); return } void openModal(event.latlng) })
  root.querySelector('#add-button')!.addEventListener('click', () => { closeDrawer(); void openModal(map.getCenter()) })
  form.querySelectorAll<HTMLButtonElement>('.type-option').forEach((option) => option.addEventListener('click', () => setModalPinKind(option.dataset.pinKind as PinKind)))
  root.querySelector('#modal-close')!.addEventListener('click', closeModal)
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal() })
  form.addEventListener('change', (event) => { const target = event.target; if (target instanceof HTMLInputElement && target.name === 'imageFile') void handleImageFileChange(target) })
  form.querySelectorAll<HTMLButtonElement>('.map-pick-button').forEach((button) => button.addEventListener('click', () => startPicking(button.dataset.pickTarget as 'note' | 'toNote')))
  form.querySelector<HTMLInputElement>('input[name="note"]')!.addEventListener('blur', (event) => void syncFieldToMap('note', event.currentTarget as HTMLInputElement))
  form.querySelector<HTMLInputElement>('input[name="toNote"]')!.addEventListener('blur', (event) => void syncFieldToMap('toNote', event.currentTarget as HTMLInputElement))
  const onDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    if (pickingTarget) { modal.hidden = false; stopPicking() }
    else if (isDrawerOpen()) closeDrawer()
  }
  document.addEventListener('keydown', onDocumentKeydown)
  form.addEventListener('click', (event) => {
    const removeButton = (event.target as HTMLElement).closest('.image-preview-remove')
    if (!removeButton) return
    const field = removeButton.closest('.image-field')
    const fileInput = field?.querySelector<HTMLInputElement>('input[name="imageFile"]')
    const urlInput = field?.querySelector<HTMLInputElement>('input[name="image"]')
    const preview = field?.querySelector<HTMLElement>('.image-preview')
    if (fileInput) fileInput.value = ''
    if (urlInput) urlInput.value = ''
    if (preview) { preview.hidden = true; const img = preview.querySelector('img'); if (img) img.src = '' }
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!pendingLocation) return
    const data = new FormData(form)
    const title = String(data.get('title'))
    const note = String(data.get('note') || '')
    const meta = String(data.get('meta') || '')
    const details = String(data.get('details') || '')
    const activeSection = form.querySelector(`[data-form-section="${modalPinKind}"]`)
    const image = getFormImage(activeSection)
    if (modalPinKind === 'sale') {
      const isEditing = editingPin?.kind === 'sale'
      const id = isEditing ? editingPin!.id : Date.now()
      upsertInto(pins, id, { id, title, note, meta, details, image, link: String(data.get('link') || ''), lat: pendingLocation.lat, lng: pendingLocation.lng, isMine: true }, isEditing)
      savePins()
    } else if (modalPinKind === 'buyer') {
      const isEditing = editingPin?.kind === 'buyer'
      const id = isEditing ? editingPin!.id : Date.now()
      upsertInto(buyerPins, id, { id, title, note, meta, details, image, lat: pendingLocation.lat, lng: pendingLocation.lng, isMine: true }, isEditing)
      saveBuyerPins()
    } else {
      const toNote = String(data.get('toNote') || '').trim()
      let toLocation: { lat: number; lng: number } | null = pendingToLocation
      if (!toLocation) {
        const submitButton = form.querySelector<HTMLButtonElement>('.form-submit')!
        const originalLabel = submitButton.textContent
        submitButton.disabled = true
        submitButton.textContent = t('form.searching')
        toLocation = await geocodeInSweden(toNote)
        submitButton.disabled = false
        submitButton.textContent = originalLabel
      }
      if (!toLocation) { alert(t('form.placeNotFound', { place: toNote })); return }
      const isEditing = editingPin?.kind === 'exchange'
      const id = isEditing ? editingPin!.id : Date.now()
      upsertInto(exchangePins, id, { id, title, meta, details, image, from: { note, lat: pendingLocation.lat, lng: pendingLocation.lng }, to: { note: toNote, lat: toLocation.lat, lng: toLocation.lng }, isMine: true }, isEditing)
      saveExchangePins()
    }
    renderPins()
    void translateUserListings()
    closeModal()
  })
  root.querySelector('#zoom-in')!.addEventListener('click', () => map.zoomIn())
  root.querySelector('#zoom-out')!.addEventListener('click', () => map.zoomOut())
  root.querySelector<HTMLButtonElement>('#map-style-toggle')!.addEventListener('click', (event) => { const button = event.currentTarget as HTMLButtonElement; const showingSatellite = map.hasLayer(satelliteLayer); if (showingSatellite) { map.removeLayer(satelliteLayer); streetLayer.addTo(map); button.title = t('style.satellite'); button.setAttribute('aria-label', t('style.toSatellite')); button.classList.remove('is-active') } else { map.removeLayer(streetLayer); satelliteLayer.addTo(map); button.title = t('style.map'); button.setAttribute('aria-label', t('style.toMap')); button.classList.add('is-active') } })
  root.querySelector<HTMLButtonElement>('#transit-toggle')!.addEventListener('click', (event) => { const button = event.currentTarget as HTMLButtonElement; const showingTransit = map.hasLayer(transitLayer); if (showingTransit) { map.removeLayer(transitLayer); button.classList.remove('is-active'); button.setAttribute('aria-label', t('transit.show')) } else { transitLayer.addTo(map); button.classList.add('is-active'); button.setAttribute('aria-label', t('transit.hide')) } })
  root.querySelector('#locate-button')!.addEventListener('click', () => map.locate({ setView: true, maxZoom: 16 }))
  searchForm.addEventListener('submit', (event) => { event.preventDefault(); void searchMap(searchInput.value) })
  searchInput.addEventListener('input', () => { updatePinSuggestions(searchInput.value); if (!isPublic) updateLocationSuggestions(searchInput.value) })
  root.querySelectorAll<HTMLButtonElement>('.list-heading[data-filter-section], .legend-item[data-filter-section]').forEach((toggle) => toggle.addEventListener('click', () => toggleKind(toggle.dataset.filterSection as PinKind)))
  bankidButton?.addEventListener('click', login)
  logoutButton?.addEventListener('click', logout)
  inboxButton?.addEventListener('click', () => {
    if (!inboxDropdown) return
    const nextHidden = !inboxDropdown.hidden
    inboxDropdown.hidden = nextHidden
    inboxButton.setAttribute('aria-expanded', String(!nextHidden))
  })
  const onDocumentClick = (event: MouseEvent) => {
    if (inboxDropdown && !inboxDropdown.hidden && !(event.target as HTMLElement).closest('.inbox-wrap')) { inboxDropdown.hidden = true; inboxButton?.setAttribute('aria-expanded', 'false') }
  }
  document.addEventListener('click', onDocumentClick)
  myListingsButton.addEventListener('click', () => { renderMyListingsDialog(); myListingsBackdrop.hidden = false })
  root.querySelector('#my-listings-close')!.addEventListener('click', () => { myListingsBackdrop.hidden = true })
  myListingsBackdrop.addEventListener('click', (event) => { if (event.target === myListingsBackdrop) myListingsBackdrop.hidden = true })
  myListingsList.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const editButton = target.closest<HTMLButtonElement>('.my-listing-edit')
    const deleteButton = target.closest<HTMLButtonElement>('.my-listing-delete')
    if (editButton) openEditModal(editButton.dataset.kind as PinKind, Number(editButton.dataset.id))
    else if (deleteButton) deleteMyPin(deleteButton.dataset.kind as PinKind, Number(deleteButton.dataset.id))
  })
  applyAuthState()
  updatePinSuggestions('')
  renderPins()
  void translateUserListings()
  function search(query: string) {
    searchInput.value = query
    void searchMap(query)
  }
  if (options.initialQuery?.trim()) search(options.initialQuery)
  return {
    search,
    unmount: () => {
      if (suggestionTimer) clearTimeout(suggestionTimer)
      suggestionRequestId += 1
      document.removeEventListener('keydown', onDocumentKeydown)
      document.removeEventListener('click', onDocumentClick)
      phoneQuery.removeEventListener('change', closeDrawer)
      map.stopLocate()
      map.remove()
      root.innerHTML = ''
    },
  }
}
