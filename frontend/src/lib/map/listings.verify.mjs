// Standalone verification for the rules of a map listing (lib/map/listings.ts): what a signed-in user may post, and
// what the map gets back. No test framework in this project (see the other *.verify.mjs). Run with:
//   npx tsx src/lib/map/listings.verify.mjs
import { cleanLink, cleanText, inSweden, LISTING_LIMITS, TEXT_LIMITS, toDto, validateListing } from "./listings.ts";
import { mapImageUrl } from "./images.ts";

let failures = 0;
function check(name, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) {
    failures++;
    if (detail !== undefined) console.log("  detail:", detail);
  }
}

const OWNER = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";
const sale = { kind: "sale", title: "Storgatan 1", note: "Storgatan 1, Eslöv", meta: "3 rok · 4 200 000 kr", details: "Ljus lägenhet.", link: "https://www.hemnet.se/bostad/1", lat: 55.83, lng: 13.3 };
const bad = (patch, owner = OWNER) => validateListing({ ...sale, ...patch }, owner);
const fieldOf = (r) => (r.ok ? null : r.field);

// ── what is accepted ────────────────────────────────────────────────────────
const ok = validateListing(sale, OWNER);
check("a sale listing is accepted and keeps its words", ok.ok && ok.value.title === "Storgatan 1" && ok.value.link === "https://www.hemnet.se/bostad/1", ok);
check("optional fields may be empty", validateListing({ ...sale, meta: "", details: null, link: "" }, OWNER).ok);
check("an exchange needs its second place", fieldOf(validateListing({ kind: "exchange", title: "Byte", note: "Södermalm", lat: 59.3, lng: 18.07 }, OWNER)) === "toPlace");
check("an exchange with both places is accepted", validateListing({ kind: "exchange", title: "Byte", note: "Södermalm", toNote: "Uppsala", lat: 59.3, lng: 18.07, toLat: 59.86, toLng: 17.64 }, OWNER).ok);
check("a buyer wish needs no link, and a link on it is ignored", (() => { const r = validateListing({ kind: "buyer", title: "Söker 2:a", note: "Södermalm", lat: 59.3, lng: 18.07, link: "javascript:alert(1)" }, OWNER); return r.ok && r.value.link === null; })());

// ── what is refused ─────────────────────────────────────────────────────────
check("not an object", fieldOf(validateListing("x", OWNER)) === "kind" && fieldOf(validateListing(null, OWNER)) === "kind");
check("an unknown kind", fieldOf(bad({ kind: "rent" })) === "kind");
check("no title", fieldOf(bad({ title: "   " })) === "title");
check("a title that is too long", fieldOf(bad({ title: "x".repeat(TEXT_LIMITS.title + 1) })) === "title");
check("no place text", fieldOf(bad({ note: "" })) === "note");
check("details that are too long", fieldOf(bad({ details: "x".repeat(TEXT_LIMITS.details + 1) })) === "details");
check("a link that is javascript:", fieldOf(bad({ link: "javascript:alert(1)" })) === "link");
check("a link with a login in it", fieldOf(bad({ link: "https://user:pass@example.com/" })) === "link");
check("a link that is not an address", fieldOf(bad({ link: "hemnet" })) === "link");
check("a place outside Sweden", fieldOf(bad({ lat: 48.85, lng: 2.35 })) === "place");
check("a place that is not a number", fieldOf(bad({ lat: "59.3" })) === "place" && fieldOf(bad({ lat: NaN })) === "place");

// ── pictures: only the sender's own upload ──────────────────────────────────
const own = `${OWNER}/abc123_X-y.webp`;
check("the sender's own uploaded picture is accepted", validateListing({ ...sale, image: own }, OWNER).ok);
check("somebody else's picture is refused", fieldOf(validateListing({ ...sale, image: `${OTHER}/abc.webp` }, OWNER)) === "image");
check("an address on another site is refused as a picture", fieldOf(bad({ image: "https://evil.example/x.jpg" })) === "image");
check("a path trick is refused as a picture", fieldOf(bad({ image: `${OWNER}/../x.webp` })) === "image" && fieldOf(bad({ image: "../../etc/passwd" })) === "image");

// ── text cleaning ───────────────────────────────────────────────────────────
check("control characters are removed, new lines stay", cleanText("a\u0000b\u0007c\nd", 20) === "abc\nd");
check("windows line endings become new lines", cleanText("a\r\nb", 20) === "a\nb");
check("edges are trimmed", cleanText("  hej  ", 20) === "hej");
check("too long text is refused, not cut", cleanText("x".repeat(21), 20) === null);
check("only http and https addresses are links", cleanLink("ftp://x.se/") === null && cleanLink("http://x.se/") === "http://x.se/");
check("Sweden's box", inSweden(59.3, 18.07) && inSweden(55.0, 13.0) && !inSweden(40, 18) && !inSweden(59, 5) && !inSweden("59", 18));
check("the limits are what the site says", LISTING_LIMITS.perDay === 10 && LISTING_LIMITS.total === 30);

// ── what the map gets ───────────────────────────────────────────────────────
const row = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", kind: "sale", owner_id: OWNER, example_key: null, title: "T", note: "N", details: null, meta: null, link: null,
  image: own, lat: 59.3, lng: 18.07, to_note: null, to_lat: null, to_lng: null, status: "hidden", hidden_reason: "spam", hidden_by: OTHER, hidden_at: "2026-10-10T00:00:00Z",
  transport: { bus: { name: "B", distanceM: 100 }, train: null, searchedWithinM: 12000, source: "transitous", fetchedAt: "2026-10-10T00:00:00Z" }, transport_status: "ready", transport_at: null,
  created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-10T00:00:00Z",
};
const dto = toDto(row, OWNER, mapImageUrl);
const text = JSON.stringify(dto);
check("the owner gets 'mine' and 'hidden', but never the owner's id, the hider or the reason", dto.isMine === true && dto.hidden === true && !text.includes(OWNER) && !text.includes(OTHER) && !text.includes("spam"), text);
check("another viewer, or nobody, does not get 'mine'", toDto(row, OTHER, mapImageUrl).isMine === false && toDto(row, null, mapImageUrl).isMine === false);
check("a sale listing carries its transport info", dto.transport?.bus?.name === "B" && dto.transportStatus === "ready");
check("a buyer wish carries none", toDto({ ...row, kind: "buyer", transport: null, transport_status: "none" }, OWNER, mapImageUrl).transportStatus === "none");
check("an example's own https picture is passed through", mapImageUrl("https://images.unsplash.com/x.jpg") === "https://images.unsplash.com/x.jpg");
check("no picture is no address", mapImageUrl(null) === null);

process.exit(failures === 0 ? 0 : 1);
