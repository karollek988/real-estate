/**
 * Atlas map workspace - the KopanalysMapDemo project, embedded in the admin portal.
 * Ported from github.com/intothenether/KopanalysMapDemo (src/main.ts, commit 10152df).
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
 *    a heading level that fits under the page's h1. Its CSS is atlas-public.scss.
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
const defaultPins: SavedPin[] = [
  { id: 1, title: 'Kanalgatan 41C', note: 'Eslövs kommun', details: 'Ljus 3:a nära centrum med balkong och låg månadsavgift.', meta: '3 rum · 78 m² · 2 495 000 kr', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 55.83626936841034, lng: 13.301669377943158 },
  { id: 2, title: 'Hörngatan 11', note: 'Trollhättans kommun', details: 'Renoverad bostad med centralt läge och närhet till resecentrum.', meta: '2 rum · 64 m² · 1 895 000 kr', image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 58.27749450906411, lng: 12.285267106116207 },
  { id: 3, title: 'Timmermansgatan 22', note: 'Södermalm, Stockholm', details: 'Sekelskifteslägenhet med högt i tak och stuckatur, gångavstånd till Slussen.', meta: '3 rum · 72 m² · 5 250 000 kr', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3151, lng: 18.0710 },
  { id: 4, title: 'Sveavägen 98', note: 'Vasastan, Stockholm', details: 'Ljus tvåa i klassisk fastighet med nära till Vasaparken och tunnelbana.', meta: '2 rum · 58 m² · 4 100 000 kr', image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3428, lng: 18.0448 },
  { id: 5, title: 'Strandvägen 7', note: 'Östermalm, Stockholm', details: 'Exklusiv våning med sjöutsikt, öppen spis och privat loftgång.', meta: '4 rum · 135 m² · 12 900 000 kr', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3358, lng: 18.0894 },
  { id: 6, title: 'Fleminggatan 45', note: 'Kungsholmen, Stockholm', details: 'Genomgående trea med balkong i två väderstreck och renoverat kök.', meta: '3 rum · 81 m² · 6 450 000 kr', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3325, lng: 18.0326 },
  { id: 7, title: 'Västerlånggatan 15', note: 'Gamla Stan, Stockholm', details: 'Charmig tvåa i medeltida kvarter med synliga takbjälkar.', meta: '2 rum · 55 m² · 4 950 000 kr', image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3251, lng: 18.0711 },
  { id: 8, title: 'Ulvsundavägen 106', note: 'Bromma, Stockholm', details: 'Rymlig villa med stor trädgård, dubbelgarage och nära till skola.', meta: '5 rum · 140 m² · 8 900 000 kr', image: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3400, lng: 17.9294 },
  { id: 9, title: 'Råsundavägen 12', note: 'Solna, Stockholm', details: 'Modern trea nära Friends Arena med gemensam takterrass.', meta: '3 rum · 76 m² · 4 700 000 kr', image: 'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3601, lng: 17.9956 },
  { id: 10, title: 'Sicklastråket 3', note: 'Nacka, Stockholm', details: 'Nyproducerad tvåa med havsutsikt och nära till Sickla köpkvarter.', meta: '2 rum · 64 m² · 3 950 000 kr', image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3053, lng: 18.1109 },
  { id: 11, title: 'Täby Torg 5', note: 'Täby, Stockholm', details: 'Fyra rum med generös planlösning nära Täby Centrum och grönområden.', meta: '4 rum · 102 m² · 6 200 000 kr', image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.4439, lng: 18.0687 },
  { id: 12, title: 'Larsviksvägen 9', note: 'Lidingö, Stockholm', details: 'Havsnära villa med brygga, orangeri och stor uteplats.', meta: '6 rum · 165 m² · 11 500 000 kr', image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3656, lng: 18.1353 },
  { id: 13, title: 'Enskedevägen 88', note: 'Enskede, Stockholm', details: 'Mysig trea i lugnt kvarter med nära till Globen och tunnelbana.', meta: '3 rum · 79 m² · 4 800 000 kr', image: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.2809, lng: 18.0810 },
  { id: 14, title: 'Maltesholmsvägen 41', note: 'Hässelby, Stockholm', details: 'Rymlig fyra med utsikt över Mälaren och nyrenoverat badrum.', meta: '4 rum · 95 m² · 3 750 000 kr', image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.3623, lng: 17.8371 },
  { id: 15, title: 'Årsta Torg 6', note: 'Årsta, Stockholm', details: 'Instegsvänlig tvåa nära pendeltåg och Årsta torg.', meta: '2 rum · 61 m² · 3 400 000 kr', image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=80', link: 'https://www.hemnet.se/', lat: 59.2934, lng: 18.0553 },
]
const defaultBuyerPins: SavedPin[] = [
  { id: 101, title: 'Familj söker villa', note: 'Södermalm', details: 'Två vuxna och ett barn söker ett långsiktigt boende nära grönområden och skolor.', meta: 'Budget upp till 8 000 000 kr · 4+ rum', lat: 59.312612847910174, lng: 18.06196320281545 },
  { id: 102, title: 'Köpare söker 2:a', note: 'Centrala Kista', details: 'Förstaboende med önskemål om goda kommunikationer och inflyttning under hösten.', meta: 'Budget upp till 2 600 000 kr · 50–70 m²', lat: 59.40263434990332, lng: 17.943175200850128 },
  { id: 103, title: 'Par söker första bostaden', note: 'Vasastan', details: 'Ungt par söker en ombonad etta eller tvåa med närhet till tunnelbana och caféer.', meta: 'Budget upp till 3 200 000 kr · 1–2 rum', lat: 59.3448, lng: 18.0480 },
  { id: 104, title: 'Köpare söker exklusiv trea', note: 'Östermalm', details: 'Söker en representativ bostad med högt i tak, gärna med balkong mot innergård.', meta: 'Budget upp till 9 500 000 kr · 3–4 rum', lat: 59.3372, lng: 18.0920 },
  { id: 105, title: 'Barnfamilj söker radhus', note: 'Hägersten', details: 'Familj med två barn önskar radhus eller parhus med nära till förskola.', meta: 'Budget upp till 6 500 000 kr · 4–5 rum', lat: 59.3040, lng: 17.9720 },
  { id: 106, title: 'Söker villa med trädgård', note: 'Bromma', details: 'Söker en villa med gott om utrymme för odling och lek, gärna med garage.', meta: 'Budget upp till 9 000 000 kr · 5+ rum', lat: 59.3430, lng: 17.9260 },
  { id: 107, title: 'Söker nyproducerad lägenhet', note: 'Solna', details: 'Söker modern nyproduktion med balkong och närhet till pendeltåg.', meta: 'Budget upp till 5 200 000 kr · 2–3 rum', lat: 59.3590, lng: 18.0000 },
  { id: 108, title: 'Söker fyra med sjöutsikt', note: 'Nacka', details: 'Familj söker rymlig bostad med vattennära läge och balkong i söderläge.', meta: 'Budget upp till 7 800 000 kr · 4 rum', lat: 59.3095, lng: 18.1580 },
  { id: 109, title: 'Familj söker villa nära skola', note: 'Täby', details: 'Söker villa i barnvänligt område med gångavstånd till skola och natur.', meta: 'Budget upp till 8 500 000 kr · 5+ rum', lat: 59.4470, lng: 18.0700 },
  { id: 110, title: 'Söker tvåa med balkong', note: 'Liljeholmen', details: 'Söker en ljus tvåa med balkong och närhet till vattnet och tunnelbana.', meta: 'Budget upp till 3 800 000 kr · 2 rum', lat: 59.3105, lng: 18.0190 },
  { id: 111, title: 'Förstagångsköpare söker etta', note: 'Årsta', details: 'Förstagångsköpare söker en mindre lägenhet med rimlig månadsavgift.', meta: 'Budget upp till 2 800 000 kr · 1–2 rum', lat: 59.2915, lng: 18.0610 },
  { id: 112, title: 'Söker radhus eller parhus', note: 'Enskede', details: 'Söker radhus med liten trädgård och nära till grönområden.', meta: 'Budget upp till 6 000 000 kr · 4 rum', lat: 59.2845, lng: 18.0780 },
  { id: 113, title: 'Söker nyproducerad tvåa', note: 'Sundbyberg', details: 'Söker modern lägenhet i nyproduktion med gemensamma ytor.', meta: 'Budget upp till 4 400 000 kr · 2–3 rum', lat: 59.3615, lng: 17.9700 },
  { id: 114, title: 'Söker större villa', note: 'Danderyd', details: 'Söker en rymlig villa med stor tomt i lugnt och barnvänligt område.', meta: 'Budget upp till 14 000 000 kr · 6+ rum', lat: 59.4020, lng: 18.0400 },
  { id: 115, title: 'Student söker etta', note: 'Uppsala', details: 'Student söker en billig etta nära universitetet med inflyttning till hösten.', meta: 'Budget upp till 1 800 000 kr · 1 rum', lat: 59.8580, lng: 17.6350 },
]
const defaultExchangePins: ExchangePin[] = [
  { id: 201, title: 'Byter 3:a mot större', details: 'Erbjuder en välplanerad 3:a och söker en större bostad med hiss och balkong.', meta: 'Erbjuder 3 rum · Söker 4+ rum · Flexibelt tillträde', from: { note: 'Södermalm, Stockholm', lat: 59.3151, lng: 18.0710 }, to: { note: 'Kungsholmen, Stockholm', lat: 59.3325, lng: 18.0326 } },
  { id: 202, title: 'Önskar byta villa', details: 'Familj vill byta från villa i Stockholm till ett lugnare läge i Uppsalaområdet.', meta: 'Erbjuder villa · Söker 4–6 rum', from: { note: 'Bromma, Stockholm', lat: 59.3400, lng: 17.9294 }, to: { note: 'Uppsala', lat: 59.8586, lng: 17.6389 } },
  { id: 203, title: 'Byter 2:a mot 3:a', details: 'Erbjuder en fräsch tvåa och söker en trea med plats för hemmakontor.', meta: 'Erbjuder 2 rum · Söker 3 rum', from: { note: 'Vasastan, Stockholm', lat: 59.3450, lng: 18.0500 }, to: { note: 'Liljeholmen, Stockholm', lat: 59.3070, lng: 18.0140 } },
  { id: 204, title: 'Byter lägenhet mot villa', details: 'Erbjuder en välskött lägenhet och söker villa med trädgård för familjen.', meta: 'Erbjuder 3 rum · Söker 5+ rum', from: { note: 'Östermalm, Stockholm', lat: 59.3380, lng: 18.0850 }, to: { note: 'Bromma, Stockholm', lat: 59.3450, lng: 17.9350 } },
  { id: 205, title: 'Byter mot hus med sjöutsikt', details: 'Erbjuder en central lägenhet och söker hus med närhet till vatten.', meta: 'Erbjuder 3 rum · Söker 4+ rum', from: { note: 'Kungsholmen, Stockholm', lat: 59.3300, lng: 18.0280 }, to: { note: 'Nacka, Stockholm', lat: 59.3080, lng: 18.1600 } },
  { id: 206, title: 'Barnfamilj byter till förort', details: 'Familj erbjuder lägenhet i city och söker lugnare läge med bra skolor.', meta: 'Erbjuder 3 rum · Söker 4–5 rum', from: { note: 'Hägersten, Stockholm', lat: 59.3030, lng: 17.9700 }, to: { note: 'Täby, Stockholm', lat: 59.4400, lng: 18.0650 } },
  { id: 207, title: 'Byter till mer centralt läge', details: 'Erbjuder en lugn förortslägenhet och söker något mer centralt.', meta: 'Erbjuder 2 rum · Söker 2–3 rum', from: { note: 'Årsta, Stockholm', lat: 59.2950, lng: 18.0500 }, to: { note: 'Södermalm, Stockholm', lat: 59.3180, lng: 18.0650 } },
  { id: 208, title: 'Byter till lugnare läge', details: 'Erbjuder en trea nära Solna centrum och söker något lugnare.', meta: 'Erbjuder 3 rum · Söker 2–3 rum', from: { note: 'Solna, Stockholm', lat: 59.3620, lng: 17.9900 }, to: { note: 'Sundbyberg, Stockholm', lat: 59.3630, lng: 17.9680 } },
  { id: 209, title: 'Byter till radhus', details: 'Erbjuder en lägenhet i Farsta och söker radhus med egen trädgård.', meta: 'Erbjuder 3 rum · Söker 4 rum', from: { note: 'Farsta, Stockholm', lat: 59.2478, lng: 18.0972 }, to: { note: 'Enskede, Stockholm', lat: 59.2830, lng: 18.0850 } },
  { id: 210, title: 'Byter mot större bostad', details: 'Erbjuder en kompakt tvåa och söker något större för växande familj.', meta: 'Erbjuder 2 rum · Söker 3–4 rum', from: { note: 'Skarpnäck, Stockholm', lat: 59.2701, lng: 18.1183 }, to: { note: 'Vällingby, Stockholm', lat: 59.3617, lng: 17.8697 } },
  { id: 211, title: 'Byter villa mot mindre villa', details: 'Erbjuder en stor villa och söker något mindre nu när barnen flyttat hemifrån.', meta: 'Erbjuder 7 rum · Söker 4–5 rum', from: { note: 'Danderyd, Stockholm', lat: 59.4014, lng: 18.0378 }, to: { note: 'Djursholm, Stockholm', lat: 59.3956, lng: 18.0817 } },
  { id: 212, title: 'Flyttar till Västkusten', details: 'Erbjuder en lägenhet på Söder och söker nytt liv i Göteborg.', meta: 'Erbjuder 3 rum · Söker 3–4 rum', from: { note: 'Södermalm, Stockholm', lat: 59.3200, lng: 18.0750 }, to: { note: 'Göteborg', lat: 57.7072, lng: 11.9668 } },
  { id: 213, title: 'Flyttar söderut', details: 'Erbjuder en lägenhet i Vasastan och söker nytt hem i Malmö.', meta: 'Erbjuder 2 rum · Söker 2–3 rum', from: { note: 'Vasastan, Stockholm', lat: 59.3470, lng: 18.0400 }, to: { note: 'Malmö', lat: 55.6050, lng: 13.0038 } },
  { id: 214, title: 'Flyttar från storstan', details: 'Erbjuder en lägenhet på Kungsholmen och söker lugnare tillvaro i Västerås.', meta: 'Erbjuder 3 rum · Söker 3–4 rum', from: { note: 'Kungsholmen, Stockholm', lat: 59.3350, lng: 18.0350 }, to: { note: 'Västerås', lat: 59.6099, lng: 16.5448 } },
  { id: 215, title: 'Flyttar till huvudstaden', details: 'Erbjuder en lägenhet i Uppsala och söker nytt hem i Stockholm.', meta: 'Erbjuder 2 rum · Söker 2–3 rum', from: { note: 'Uppsala', lat: 59.8586, lng: 17.6389 }, to: { note: 'Kungsholmen, Stockholm', lat: 59.3310, lng: 18.0300 } },
]

export interface AtlasOptions {
  /** 'admin' (default) is the admin portal's workspace; 'public' is /karta - see the header comment. */
  variant?: 'admin' | 'public'
  /** Looked up as soon as the map is ready (/karta?q=...). */
  initialQuery?: string
  /** The "Skapa analys" button in a listing's detail panel. */
  onCreateAnalysis?: () => void
}

export interface AtlasHandle {
  /** Looks a query up among the pins, then as a place in Sweden - the search form's own search. */
  search: (query: string) => void
  unmount: () => void
}

export function mountAtlas(root: HTMLElement, options: AtlasOptions = {}): AtlasHandle {
  const isPublic = options.variant === 'public'
  let pins: SavedPin[] = readStoredPins(storageKey, defaultPins)
  let buyerPins: SavedPin[] = readStoredPins(buyerStorageKey, defaultBuyerPins)
  function loadExchangePins(): ExchangePin[] {
    try {
      const raw = localStorage.getItem(exchangeStorageKey)
      if (!raw) return structuredClone(defaultExchangePins)
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item === 'object' && 'from' in item && 'to' in item)) return parsed as ExchangePin[]
      return structuredClone(defaultExchangePins)
    } catch { return structuredClone(defaultExchangePins) }
  }
  let exchangePins: ExchangePin[] = loadExchangePins()
  const visibleKinds: Record<PinKind, boolean> = { sale: true, buyer: true, exchange: true }

  // On /karta the site layout already has the page's <main>.
  const shellTag = isPublic ? 'div' : 'main'
  root.innerHTML = `
    <${shellTag} class="app-shell">
      <header class="topbar">
        ${isPublic ? '' : '<a class="brand" href="/" aria-label="Köpanalys Karta"><img class="brand-mark" src="/_next/image?url=%2Fkopanalys-bostad-logo.png&w=64&q=75" alt="Köpanalys"><span>Köpanalys Karta</span></a>'}
        <form class="search-form" id="search-form" role="search"><span class="search-icon">⌕</span><input id="search-input" list="search-suggestions" type="search" placeholder="Sök plats eller pin..." autocomplete="off" aria-label="Sök plats eller pin"><datalist id="search-suggestions"></datalist><button type="submit">Sök</button></form>
        <div class="topbar-actions">
          ${isPublic ? '<div class="auth-actions" id="auth-actions"><button class="icon-button" id="my-listings-button" type="button" aria-label="Mina annonser" title="Mina annonser"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12" y2="16"></line></svg></button></div>' : `
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
            <button class="icon-button" id="my-listings-button" type="button" aria-label="Mina annonser" title="Mina annonser"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12" y2="16"></line></svg></button>
            <button class="logout-button" id="logout-button" type="button">Logga ut</button>
          </div>
          `}
          <button class="icon-button" id="locate-button" title="Visa min position" aria-label="Visa min position">⌖</button>
        </div>
      </header>
      <section class="workspace">
        <aside class="sidebar">
          <div class="sidebar-header"><div><p class="eyebrow">Karta</p>${isPublic ? '<h2>Bostadsmarknaden</h2>' : '<h1>Bostadsmarknaden</h1>'}</div></div>
          <p class="intro">Översikt över Sveriges bostadsmarknad. Här kan du se bostäder till salu och köpförfrågan.</p>
          <div class="action-row"><button class="primary-button" id="add-button"><span>＋</span> Skapa annons</button></div>
          <button type="button" class="list-heading" data-filter-section="sale" aria-pressed="true"><span class="heading-dot"></span><span>Till salu</span><strong id="pin-count">${pins.length}</strong></button>
          <div class="pin-list" id="pin-list" data-filter-section="sale"></div>
          <button type="button" class="list-heading buyer-heading" data-filter-section="buyer" aria-pressed="true"><span class="heading-dot"></span><span>Köpare söker</span><strong id="buyer-count">${buyerPins.length}</strong></button>
          <div class="pin-list" id="buyer-list" data-filter-section="buyer"></div>
          <button type="button" class="list-heading exchange-heading" data-filter-section="exchange" aria-pressed="true"><span class="heading-dot"></span><span>Byter bostad</span><strong id="exchange-count">${exchangePins.length}</strong></button>
          <div class="pin-list" id="exchange-list" data-filter-section="exchange"></div>
          <div class="sidebar-footer"><div class="source-row"><span class="map-badge">●</span><span>OpenStreetMap data</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Om</a></div>${isPublic ? '' : '<small class="copyright">© 2026 Köpanalys. Org.nr 9811048793</small>'}</div>
        </aside>
        <div class="map-wrap"><div id="map"></div><div class="map-hint" id="map-hint"><span>＋</span> Klicka för att lägga till ett pin.</div><div class="zoom-control" id="zoom-control"><button id="zoom-in" aria-label="Zooma in">＋</button><button id="zoom-out" aria-label="Zooma ut">−</button><button id="map-style-toggle" class="map-style-toggle" aria-label="Byt till satellitkarta" title="Satellit"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(-45 12 12)"><rect x="2.5" y="9.5" width="6" height="5" rx="1.2"></rect><rect x="15.5" y="9.5" width="6" height="5" rx="1.2"></rect><rect x="9.5" y="9" width="5" height="6" rx="1.2"></rect><line x1="8.5" y1="12" x2="9.5" y2="12"></line><line x1="14.5" y1="12" x2="15.5" y2="12"></line></g></svg></button><button id="transit-toggle" class="transit-toggle" aria-label="Visa tåg- och tunnelbanelinjer" title="Tåg- och tunnelbanelinjer"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="13" rx="4"></rect><line x1="6" y1="10" x2="18" y2="10"></line><circle cx="9.5" cy="13.2" r="0.6" fill="currentColor" stroke="none"></circle><circle cx="14.5" cy="13.2" r="0.6" fill="currentColor" stroke="none"></circle><line x1="8" y1="17" x2="6" y2="20"></line><line x1="16" y1="17" x2="18" y2="20"></line></svg></button></div><div class="map-legend" id="map-legend" role="group" aria-label="Filtrera kartan"><button type="button" class="legend-item" data-filter-section="sale" aria-pressed="true"><span class="legend-dot"></span>Till salu</button><button type="button" class="legend-item" data-filter-section="buyer" aria-pressed="true"><span class="legend-dot"></span>Köpare söker</button><button type="button" class="legend-item" data-filter-section="exchange" aria-pressed="true"><span class="legend-dot"></span>Byter bostad</button></div><aside class="detail-panel" id="detail-panel" hidden></aside></div>
      </section>
      <div class="modal-backdrop" id="modal-backdrop" hidden><form class="place-modal" id="place-form"><button type="button" class="modal-close" id="modal-close" aria-label="Stäng">×</button><p class="eyebrow">Ny kartmarkering</p><h2 id="form-title">Lägg till bostad till salu</h2><div class="pin-type-switch" role="tablist" aria-label="Typ av pin"><button type="button" class="type-option is-active" data-pin-kind="sale" role="tab" aria-selected="true">Till salu</button><button type="button" class="type-option" data-pin-kind="buyer" role="tab" aria-selected="false">Köpare söker</button><button type="button" class="type-option" data-pin-kind="exchange" role="tab" aria-selected="false">Byter bostad</button></div><div class="field-grid"><label>Rubrik<input name="title" required maxlength="60" placeholder="t.ex. Villa nära centrum"></label><label id="note-label">Plats eller område<span class="address-input"><input name="note" required maxlength="100" placeholder="t.ex. Eslövs kommun"><button type="button" class="map-pick-button" data-pick-target="note" aria-label="Välj plats på kartan" title="Välj plats på kartan">⌖</button></span></label></div><div class="form-section" data-form-section="sale"><label>Pris, storlek och rum<input name="meta" maxlength="100" placeholder="t.ex. 3 rum · 78 m² · 2 495 000 kr"></label><div class="image-field"><div class="field-grid"><label>Bildlänk <span>valfritt</span><input name="image" type="url" placeholder="https://..."></label><label class="file-field">Ladda upp bild <span>valfritt</span><input name="imageFile" type="file" accept="image/*" class="file-input"></label></div><div class="image-preview" hidden><img alt=""><button type="button" class="image-preview-remove" aria-label="Ta bort bild">×</button></div></div><label>Annonslänk <span>valfritt</span><input name="link" type="url" placeholder="https://www.hemnet.se/..."></label><label>Beskrivning <span>valfritt</span><textarea name="details" maxlength="300" placeholder="Beskriv bostaden kort"></textarea></label></div><div class="form-section" data-form-section="buyer" hidden><label>Budget och önskemål<input name="meta" maxlength="120" placeholder="t.ex. Budget upp till 3 000 000 kr · 2–3 rum"></label><div class="image-field"><div class="field-grid"><label>Bildlänk <span>valfritt</span><input name="image" type="url" placeholder="https://..."></label><label class="file-field">Ladda upp bild <span>valfritt</span><input name="imageFile" type="file" accept="image/*" class="file-input"></label></div><div class="image-preview" hidden><img alt=""><button type="button" class="image-preview-remove" aria-label="Ta bort bild">×</button></div></div><label>Mer information<textarea name="details" maxlength="300" placeholder="Vad söker köparen? Berätta om läge, storlek och tidsplan."></textarea></label></div><div class="form-section" data-form-section="exchange" hidden><div class="field-grid"><label>Erbjuder och söker<input name="meta" maxlength="120" placeholder="t.ex. Erbjuder 3 rum · Söker 4+ rum"></label><label>Vill bo i<span class="address-input"><input name="toNote" required maxlength="100" placeholder="t.ex. Uppsala"><button type="button" class="map-pick-button" data-pick-target="toNote" aria-label="Välj plats på kartan" title="Välj plats på kartan">⌖</button></span></label></div><div class="image-field"><div class="field-grid"><label>Bildlänk <span>valfritt</span><input name="image" type="url" placeholder="https://..."></label><label class="file-field">Ladda upp bild <span>valfritt</span><input name="imageFile" type="file" accept="image/*" class="file-input"></label></div><div class="image-preview" hidden><img alt=""><button type="button" class="image-preview-remove" aria-label="Ta bort bild">×</button></div></div><label>Bytesinformation<textarea name="details" maxlength="300" placeholder="Beskriv bostaden som erbjuds och vad personen vill byta till."></textarea></label></div><button class="primary-button form-submit" type="submit">Spara pin</button></form></div>
      <div class="modal-backdrop" id="my-listings-backdrop" hidden><div class="place-modal my-listings-modal"><button type="button" class="modal-close" id="my-listings-close" aria-label="Stäng">×</button><p class="eyebrow">Mitt konto</p><h2>Mina annonser</h2><div class="my-listings-list" id="my-listings-list"></div></div></div>
    </${shellTag}>
  `

  const map = L.map(root.querySelector<HTMLElement>('#map')!, { zoomControl: false })
  const swedenBounds = L.latLngBounds([[55.0, 10.5], [69.2, 24.2]])
  map.fitBounds(swedenBounds, { padding: [28, 28] })
  const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
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
  const exchangeMarkers = new Map<number, { from: L.Marker; to: L.Marker; arc: L.Polyline }>()
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

  function selectPin(pin: SavedPin, kind: 'sale' | 'buyer') {
    setArcHighlight(null)
    setSelectedMarker(`${kind}-${pin.id}`)
    map.flyTo([pin.lat, pin.lng], 15, { duration: 0.8 })
    const labels: Record<'sale' | 'buyer', string> = { sale: 'Till salu', buyer: 'Köpare söker' }
    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`
    const contactLink = `mailto:kontakt@kopanalys.se?subject=${encodeURIComponent(`Kontakt om ${pin.title}`)}`
    const hasPhoto = kind === 'sale' || Boolean(pin.image)
    const tag = `<span class="detail-tag${kind === 'buyer' ? ' detail-tag-buyer' : ''}">${labels[kind]}</span>`
    const photoBlock = hasPhoto ? `<div class="detail-photo-wrap"><img class="detail-photo" src="${esc(safeImage(pin.image) ?? DEFAULT_LISTING_PHOTO)}" alt="Foto av ${esc(pin.title)}">${tag}</div>` : ''
    const bodyOpen = hasPhoto ? '<div class="detail-body">' : '<div class="detail-body detail-body-compact">'
    const inlineTag = hasPhoto ? '' : tag
    const actionBlock = kind === 'sale'
      ? `<a class="detail-link" href="${esc(safeHref(pin.link) ?? 'https://www.hemnet.se/')}" target="_blank" rel="noreferrer">Se annonsen <span>↗</span></a>`
      : `<div class="detail-contact"><span class="contact-dot"></span><span>Förfrågan aktiv</span></div><a class="detail-contact-link" href="${contactLink}">Kontakt <span>↗</span></a>`
    const createAnalysisBlock = kind === 'sale' ? '<button type="button" class="detail-create-analysis">Skapa analys</button>' : ''
    const panelContent = `${photoBlock}${bodyOpen}<button class="detail-close" id="detail-close" aria-label="Stäng">×</button>${inlineTag}<h2>${esc(pin.title)}</h2><p class="detail-note">${esc(pin.note)}</p><p class="detail-meta">${esc(pin.meta ?? (kind === 'sale' ? 'Kontakta säljaren för fler uppgifter' : 'Detaljerad förfrågan'))}</p><p class="detail-description">${esc(pin.details ?? (kind === 'sale' ? 'Se annonsen för fullständig information om bostaden.' : 'Kontakta personen för mer information om önskemål och tidsplan.'))}</p>${actionBlock}<a class="detail-map-link" href="${googleMapsLink}" target="_blank" rel="noreferrer">Öppna i Google Maps <span>↗</span></a>${createAnalysisBlock}</div>`
    detailPanel.innerHTML = panelContent
    detailPanel.hidden = false
    detailPanel.querySelector('#detail-close')?.addEventListener('click', closeDetail)
    if (options.onCreateAnalysis) detailPanel.querySelector('.detail-create-analysis')?.addEventListener('click', options.onCreateAnalysis)
  }
  function closeDetail() { detailPanel.hidden = true; setArcHighlight(null); setSelectedMarker(null) }
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
    if (item) { item.classList.add('is-selected'); item.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }
  }

  function setArcHighlight(id: number | null) {
    exchangeMarkers.forEach((group, groupId) => {
      const active = groupId === id
      group.arc.setStyle({ color: active ? '#fca5a5' : '#f87171', weight: active ? 5 : 2, opacity: active ? 1 : id === null ? 0.8 : 0.2 })
      group.arc.getElement()?.classList.toggle('exchange-arc-active', active)
      if (active) group.arc.bringToFront()
    })
  }

  function focusExchangeStop(pin: ExchangePin, which: 'from' | 'to') {
    const location = pin[which]
    setArcHighlight(pin.id)
    const target: L.LatLngExpression = [location.lat, location.lng]
    if (map.getZoom() === 15) map.panTo(target, { duration: 0.6 })
    else map.flyTo(target, 15, { duration: 0.6 })
    const group = exchangeMarkers.get(pin.id)
    ;(which === 'from' ? group?.from : group?.to)?.openTooltip()
    detailPanel.querySelectorAll<HTMLButtonElement>('.exchange-stop').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === which))
  }

  function selectExchangePin(pin: ExchangePin) {
    setArcHighlight(pin.id)
    setSelectedMarker(`exchange-${pin.id}`)
    const bounds = L.latLngBounds([[pin.from.lat, pin.from.lng], [pin.to.lat, pin.to.lng]])
    map.flyToBounds(bounds, { padding: [90, 90], maxZoom: 13, duration: 0.8 })
    const fromMapsLink = `https://www.google.com/maps/search/?api=1&query=${pin.from.lat},${pin.from.lng}`
    const toMapsLink = `https://www.google.com/maps/search/?api=1&query=${pin.to.lat},${pin.to.lng}`
    const contactLink = `mailto:kontakt@kopanalys.se?subject=${encodeURIComponent(`Kontakt om ${pin.title}`)}`
    const tag = `<span class="detail-tag detail-tag-exchange">Byter bostad</span>`
    const photoBlock = pin.image ? `<div class="detail-photo-wrap"><img class="detail-photo" src="${esc(safeImage(pin.image))}" alt="Foto av ${esc(pin.title)}">${tag}</div>` : ''
    const bodyOpen = pin.image ? '<div class="detail-body">' : '<div class="detail-body detail-body-compact">'
    const inlineTag = pin.image ? '' : tag
    detailPanel.innerHTML = `${photoBlock}${bodyOpen}<button class="detail-close" id="detail-close" aria-label="Stäng">×</button>${inlineTag}<h2>${esc(pin.title)}</h2><div class="exchange-route"><button type="button" class="exchange-stop" data-nav="from"><span class="exchange-dot exchange-dot-from"></span><div><small>Bor nu</small><strong>${esc(pin.from.note)}</strong></div></button><div class="exchange-route-arrow">→</div><button type="button" class="exchange-stop" data-nav="to"><span class="exchange-dot exchange-dot-to"></span><div><small>Vill bo</small><strong>${esc(pin.to.note)}</strong></div></button></div><p class="detail-meta">${esc(pin.meta)}</p><p class="detail-description">${esc(pin.details ?? 'Kontakta personen för mer information om önskemål och tidsplan.')}</p><div class="detail-contact"><span class="contact-dot"></span><span>Förfrågan aktiv</span></div><a class="detail-contact-link" href="${contactLink}">Kontakt <span>↗</span></a><a class="detail-map-link" href="${fromMapsLink}" target="_blank" rel="noreferrer">Nuvarande plats <span>↗</span></a><a class="detail-map-link" href="${toMapsLink}" target="_blank" rel="noreferrer">Önskad plats <span>↗</span></a></div>`
    detailPanel.hidden = false
    detailPanel.querySelector('#detail-close')?.addEventListener('click', closeDetail)
    detailPanel.querySelector('[data-nav="from"]')?.addEventListener('click', () => focusExchangeStop(pin, 'from'))
    detailPanel.querySelector('[data-nav="to"]')?.addEventListener('click', () => focusExchangeStop(pin, 'to'))
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
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': 'sv' } })
      if (!response.ok) return null
      const results = await response.json() as Array<{ lat: string; lon: string }>
      const result = results[0]
      return result ? { lat: Number(result.lat), lng: Number(result.lon) } : null
    } catch { return null }
  }

  async function reverseGeocodeInSweden(lat: number, lng: number): Promise<string | null> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'sv' } })
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
    const saleIndex = pins.findIndex((pin) => `${pin.title} ${pin.note} ${pin.details ?? ''}`.toLocaleLowerCase('sv-SE').includes(normalizedQuery))
    if (saleIndex >= 0) { selectPin(pins[saleIndex], 'sale'); return }
    const buyerIndex = buyerPins.findIndex((pin) => `${pin.title} ${pin.note} ${pin.details ?? ''}`.toLocaleLowerCase('sv-SE').includes(normalizedQuery))
    if (buyerIndex >= 0) { selectPin(buyerPins[buyerIndex], 'buyer'); return }
    const exchangeMatch = exchangePins.find((pin) => `${pin.title} ${pin.from.note} ${pin.to.note} ${pin.details ?? ''}`.toLocaleLowerCase('sv-SE').includes(normalizedQuery))
    if (exchangeMatch) { selectExchangePin(exchangeMatch); return }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': 'sv' } })
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
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=se&q=${encodeURIComponent(trimmedQuery)}`, { headers: { 'Accept-Language': 'sv' } })
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
    exchangeMarkers.forEach((group) => { group.from.remove(); group.to.remove(); group.arc.remove() })
    exchangeMarkers.clear()
    root.querySelectorAll<HTMLElement>('.pin-list[data-filter-section]').forEach((section) => { section.hidden = !visibleKinds[section.dataset.filterSection as PinKind] })
    root.querySelectorAll<HTMLButtonElement>('.list-heading[data-filter-section], .legend-item[data-filter-section]').forEach((toggle) => {
      const active = visibleKinds[toggle.dataset.filterSection as PinKind]
      toggle.classList.toggle('is-off', !active)
      toggle.setAttribute('aria-pressed', String(active))
    })
    list.innerHTML = pins.length ? pins.map((pin, index) => `<button class="pin-item" data-id="${pin.id}">${thumbMarkup(pin.image, index + 1)}<span class="pin-item-text"><strong>${esc(pin.title)}</strong><small>${esc(pin.note || `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`)}</small></span><span class="item-arrow">›</span></button>`).join('') : '<div class="empty-state">Inga bostäder ännu.<br>Klicka på kartan för att lägga till en.</div>'
    buyerList.innerHTML = buyerPins.length ? buyerPins.map((pin, index) => `<button class="pin-item buyer-item" data-id="${pin.id}">${thumbMarkup(pin.image, index + 1)}<span class="pin-item-text"><strong>${esc(pin.title)}</strong><small>${esc(pin.note || `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`)}</small></span><span class="item-arrow">›</span></button>`).join('') : '<div class="empty-state">Inga köpare ännu.</div>'
    exchangeList.innerHTML = exchangePins.length ? exchangePins.map((pin, index) => `<button class="pin-item exchange-item" data-id="${pin.id}">${thumbMarkup(pin.image, index + 1)}<span class="pin-item-text"><strong>${esc(pin.title)}</strong><small>${esc(pin.from.note)} → ${esc(pin.to.note)}</small></span><span class="item-arrow">›</span></button>`).join('') : '<div class="empty-state">Inga bytesförfrågningar ännu.</div>'
    root.querySelector('#pin-count')!.textContent = String(pins.length)
    root.querySelector('#buyer-count')!.textContent = String(buyerPins.length)
    root.querySelector('#exchange-count')!.textContent = String(exchangePins.length)
    if (isFilterVisible('sale')) pins.forEach((pin, index) => { const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon }).addTo(map).bindTooltip(`${index + 1}. ${esc(pin.title)}`, { direction: 'top', offset: [0, -28] }).on('click', () => selectPin(pin, 'sale')); markers.set(pin.id, marker) })
    if (isFilterVisible('buyer')) buyerPins.forEach((pin, index) => { const marker = L.marker([pin.lat, pin.lng], { icon: buyerPinIcon }).addTo(map).bindTooltip(`Köpare ${index + 1}. ${esc(pin.title)}`, { direction: 'top', offset: [0, -28] }).on('click', () => selectPin(pin, 'buyer')); buyerMarkers.set(pin.id, marker) })
    if (isFilterVisible('exchange')) exchangePins.forEach((pin, index) => {
      const arc = L.polyline(buildArc(pin.from.lat, pin.from.lng, pin.to.lat, pin.to.lng), { className: 'exchange-arc', color: '#f87171', weight: 2, opacity: 0.8, dashArray: '1 10', lineCap: 'round' }).addTo(map)
      const fromMarker = L.marker([pin.from.lat, pin.from.lng], { icon: exchangeFromIcon }).addTo(map).bindTooltip(`Byte ${index + 1}: ${esc(pin.title)}`, { direction: 'top', offset: [0, -28] }).on('click', () => selectExchangePin(pin))
      const toMarker = L.marker([pin.to.lat, pin.to.lng], { icon: exchangeToIcon }).addTo(map).bindTooltip(`Byte ${index + 1}: vill bo i ${esc(pin.to.note)}`, { direction: 'top', offset: [0, -28] }).on('click', () => selectExchangePin(pin))
      exchangeMarkers.set(pin.id, { from: fromMarker, to: toMarker, arc })
    })
    list.querySelectorAll<HTMLButtonElement>('.pin-item').forEach((item) => item.addEventListener('click', () => { const index = pins.findIndex((candidate) => candidate.id === Number(item.dataset.id)); if (index >= 0) selectPin(pins[index], 'sale') }))
    buyerList.querySelectorAll<HTMLButtonElement>('.pin-item').forEach((item) => item.addEventListener('click', () => { const index = buyerPins.findIndex((candidate) => candidate.id === Number(item.dataset.id)); if (index >= 0) selectPin(buyerPins[index], 'buyer') }))
    exchangeList.querySelectorAll<HTMLButtonElement>('.pin-item').forEach((item) => item.addEventListener('click', () => { const pin = exchangePins.find((candidate) => candidate.id === Number(item.dataset.id)); if (pin) selectExchangePin(pin) }))
    setSelectedMarker(selectedPinKey)
  }
  function setModalPinKind(kind: PinKind) {
    modalPinKind = kind
    const titles: Record<PinKind, string> = { sale: 'Lägg till bostad till salu', buyer: 'Lägg till köpare', exchange: 'Lägg till bytesförfrågan' }
    root.querySelector('#form-title')!.textContent = titles[kind]
    form.querySelectorAll<HTMLButtonElement>('.type-option').forEach((option) => { const active = option.dataset.pinKind === kind; option.classList.toggle('is-active', active); option.setAttribute('aria-selected', String(active)) })
    form.querySelectorAll<HTMLElement>('[data-form-section]').forEach((section) => { const active = section.dataset.formSection === kind; section.hidden = !active; section.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((control) => { control.disabled = !active }) })
    const noteLabel = root.querySelector('#note-label')!
    noteLabel.firstChild!.textContent = kind === 'sale' ? 'Plats eller område' : kind === 'buyer' ? 'Önskat område' : 'Bor nu (plats)'
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
    mapHint.innerHTML = '<span>⌖</span> Klicka på kartan för att välja plats.'
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
    input.placeholder = 'Hämtar adress...'
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
    noteInput.placeholder = 'Hämtar adress...'
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
    form.querySelector<HTMLButtonElement>('.form-submit')!.textContent = 'Spara pin'
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
    return `<div class="my-listing-row">${myListingThumb(image)}<span class="pin-item-text"><strong>${esc(title)}</strong><small>${esc(note)}</small></span><span class="my-listing-actions"><span class="my-listing-tag${tagClass}">${tagLabel}</span><button type="button" class="my-listing-edit" data-kind="${kind}" data-id="${id}">Redigera</button><button type="button" class="my-listing-delete" data-kind="${kind}" data-id="${id}">Ta bort</button></span></div>`
  }
  function renderMyListingsDialog() {
    const rows: string[] = []
    pins.filter((pin) => pin.isMine).forEach((pin) => rows.push(myListingRow('sale', pin.id, pin.image, pin.title, pin.note, '', 'Till salu')))
    buyerPins.filter((pin) => pin.isMine).forEach((pin) => rows.push(myListingRow('buyer', pin.id, pin.image, pin.title, pin.note, ' my-listing-tag-buyer', 'Köpare söker')))
    exchangePins.filter((pin) => pin.isMine).forEach((pin) => rows.push(myListingRow('exchange', pin.id, pin.image, pin.title, `${pin.from.note} → ${pin.to.note}`, ' my-listing-tag-exchange', 'Byter bostad')))
    myListingsList.innerHTML = rows.length ? rows.join('') : '<div class="empty-state">Du har inte lagt till några annonser ännu.<br>Klicka på "Skapa annons" för att komma igång.</div>'
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
    root.querySelector('#form-title')!.textContent = 'Redigera annons'
    form.querySelector<HTMLButtonElement>('.form-submit')!.textContent = 'Spara ändringar'
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
    if (!confirm('Vill du ta bort den här annonsen?')) return
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
  root.querySelector('#add-button')!.addEventListener('click', () => openModal(map.getCenter()))
  form.querySelectorAll<HTMLButtonElement>('.type-option').forEach((option) => option.addEventListener('click', () => setModalPinKind(option.dataset.pinKind as PinKind)))
  root.querySelector('#modal-close')!.addEventListener('click', closeModal)
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal() })
  form.addEventListener('change', (event) => { const target = event.target; if (target instanceof HTMLInputElement && target.name === 'imageFile') void handleImageFileChange(target) })
  form.querySelectorAll<HTMLButtonElement>('.map-pick-button').forEach((button) => button.addEventListener('click', () => startPicking(button.dataset.pickTarget as 'note' | 'toNote')))
  form.querySelector<HTMLInputElement>('input[name="note"]')!.addEventListener('blur', (event) => void syncFieldToMap('note', event.currentTarget as HTMLInputElement))
  form.querySelector<HTMLInputElement>('input[name="toNote"]')!.addEventListener('blur', (event) => void syncFieldToMap('toNote', event.currentTarget as HTMLInputElement))
  const onDocumentKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && pickingTarget) { modal.hidden = false; stopPicking() } }
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
        submitButton.textContent = 'Söker plats...'
        toLocation = await geocodeInSweden(toNote)
        submitButton.disabled = false
        submitButton.textContent = originalLabel
      }
      if (!toLocation) { alert(`Kunde inte hitta platsen "${toNote}". Försök med en annan sökning.`); return }
      const isEditing = editingPin?.kind === 'exchange'
      const id = isEditing ? editingPin!.id : Date.now()
      upsertInto(exchangePins, id, { id, title, meta, details, image, from: { note, lat: pendingLocation.lat, lng: pendingLocation.lng }, to: { note: toNote, lat: toLocation.lat, lng: toLocation.lng }, isMine: true }, isEditing)
      saveExchangePins()
    }
    renderPins()
    closeModal()
  })
  root.querySelector('#zoom-in')!.addEventListener('click', () => map.zoomIn())
  root.querySelector('#zoom-out')!.addEventListener('click', () => map.zoomOut())
  root.querySelector<HTMLButtonElement>('#map-style-toggle')!.addEventListener('click', (event) => { const button = event.currentTarget as HTMLButtonElement; const showingSatellite = map.hasLayer(satelliteLayer); if (showingSatellite) { map.removeLayer(satelliteLayer); streetLayer.addTo(map); button.title = 'Satellit'; button.setAttribute('aria-label', 'Byt till satellitkarta'); button.classList.remove('is-active') } else { map.removeLayer(streetLayer); satelliteLayer.addTo(map); button.title = 'Karta'; button.setAttribute('aria-label', 'Byt till vanlig karta'); button.classList.add('is-active') } })
  root.querySelector<HTMLButtonElement>('#transit-toggle')!.addEventListener('click', (event) => { const button = event.currentTarget as HTMLButtonElement; const showingTransit = map.hasLayer(transitLayer); if (showingTransit) { map.removeLayer(transitLayer); button.classList.remove('is-active'); button.setAttribute('aria-label', 'Visa tåg- och tunnelbanelinjer') } else { transitLayer.addTo(map); button.classList.add('is-active'); button.setAttribute('aria-label', 'Dölj tåg- och tunnelbanelinjer') } })
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
      map.stopLocate()
      map.remove()
      root.innerHTML = ''
    },
  }
}
