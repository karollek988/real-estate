// Standalone verification for the language plumbing: how an address is split into language and page, how a request's
// language is found, and that a text a language lacks is shown in Swedish. No test framework in this project (see the
// other *.verify.mjs). Run with:
//   npx tsx src/i18n/i18n.verify.mjs
import { splitLocale, resolveInternal, isLanguageNeutral } from "./path.ts";
import { localeOfRequest, statedLocaleOfRequest } from "./requestLocale.ts";
import { localizeUrl } from "./redirect.ts";
import { loadMessages, loadOwnMessages, overlay } from "./messages/index.ts";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}`);
  if (!pass) {
    failures++;
    console.log("  expected:", JSON.stringify(expected));
    console.log("  actual:  ", JSON.stringify(actual));
  }
}

// ── addresses ────────────────────────────────────────────────────────────────
check("Swedish has no prefix", splitLocale("/priser"), { locale: "sv", prefixed: false, rest: "/priser" });
check("English prefix is split off", splitLocale("/en/pricing"), { locale: "en", prefixed: true, rest: "/pricing" });
check("the language alone is the home page", splitLocale("/en"), { locale: "en", prefixed: true, rest: "/" });
check("a trailing slash is ignored", splitLocale("/en/pricing/"), { locale: "en", prefixed: true, rest: "/pricing" });
check("/sv/... counts as Swedish", splitLocale("/sv/priser"), { locale: "sv", prefixed: true, rest: "/priser" });
check("an unknown prefix is not a language", splitLocale("/xx/priser"), { locale: "sv", prefixed: false, rest: "/xx/priser" });

check("a page by its Swedish name", resolveInternal("/priser"), { pathname: "/priser", params: {} });
check("a dynamic page gives its parameter", resolveInternal("/guider/infor-visningen"), { pathname: "/guider/[slug]", params: { slug: "infor-visningen" } });
check("no page of that name", resolveInternal("/finns-inte"), null);

check("the API has no language", isLanguageNeutral("/api/chat"), true);
check("a page has one", isLanguageNeutral("/priser"), false);

// ── the same address in another language ─────────────────────────────────────
check("Swedish stays as it is", localizeUrl(new URL("https://kopanalys.se/priser"), "sv").pathname, "/priser");
check("a page gets its English name", localizeUrl(new URL("https://kopanalys.se/priser"), "en").pathname, "/en/pricing");
check("the query stays", localizeUrl(new URL("https://kopanalys.se/skapa-analys?q=abc"), "en").search, "?q=abc");
check("a dynamic page keeps its parameter", localizeUrl(new URL("https://kopanalys.se/guider/infor-visningen"), "en").pathname, "/en/guides/infor-visningen");
check("an unknown address is left alone", localizeUrl(new URL("https://kopanalys.se/finns-inte"), "en").pathname, "/finns-inte");

// ── the language of an API request ───────────────────────────────────────────
const req = (headers) => ({ headers: new Headers(headers) });
check("the page the request came from decides", localeOfRequest(req({ referer: "https://kopanalys.se/en/dashboard" })), "en");
check("a Swedish page", localeOfRequest(req({ referer: "https://kopanalys.se/dashboard" })), "sv");
check("the language picker's cookie is next", localeOfRequest(req({ cookie: "a=1; NEXT_LOCALE=en" })), "en");
check("a language the page states wins", localeOfRequest(req({ referer: "https://kopanalys.se/dashboard" }), "en"), "en");
check("an unknown stated language is ignored", localeOfRequest(req({ referer: "https://kopanalys.se/en/x" }), "xx"), "en");
check("nothing said: the default language", localeOfRequest(req({})), "sv");
check("nothing said: no stated language", statedLocaleOfRequest(req({})), null);
check("a cookie with a language that does not exist is ignored", statedLocaleOfRequest(req({ cookie: "NEXT_LOCALE=xx" })), null);

// ── texts a language lacks are shown in Swedish ──────────────────────────────
const swedish = await loadMessages("sv");
const english = await loadMessages("en");
check("English has its own text", english.common !== swedish.common, true);
const own = await loadOwnMessages("en");
check("an area is complete in English", Object.keys(own).sort().join(), Object.keys(swedish).sort().join());

const base = { a: { x: "sv-x", y: "sv-y" }, b: "sv-b", list: ["sv-1", "sv-2"] };
check("a missing text falls back to Swedish", overlay(base, { a: { x: "en-x" } }), { a: { x: "en-x", y: "sv-y" }, b: "sv-b", list: ["sv-1", "sv-2"] });
check("a whole missing area falls back", overlay(base, { b: "en-b" }), { a: { x: "sv-x", y: "sv-y" }, b: "en-b", list: ["sv-1", "sv-2"] });
check("an undefined text does not erase the Swedish one", overlay(base, { b: undefined }), base);
check("the Swedish master is not changed", base.a.x, "sv-x");

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll language checks passed.");
