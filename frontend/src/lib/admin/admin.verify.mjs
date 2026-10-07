// Standalone verification for the admin portal auth (no test framework in
// this project - see helpers.verify.mjs). Uses only generated throwaway
// passwords: the real admin password is never written to any file.
//
// Run with:
//   npx tsx src/lib/admin/admin.verify.mjs
//
// Optional: confirm the hash built into credentials.ts matches the password
// you believe it is, without storing that password anywhere:
//   ADMIN_VERIFY_DEFAULT_PASSWORD='<password>' npx tsx src/lib/admin/admin.verify.mjs
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as loginPost } from "../../app/api/admin-portal/login/route.ts";
import { POST as logoutPost } from "../../app/api/admin-portal/logout/route.ts";
import { routeAdminHost } from "./adminProxy.ts";
import { ADMIN_USERNAME, getAdminPasswordHash, verifyAdminLogin } from "./credentials.ts";
import { isAdminHost } from "./host.ts";
import { checkLoginThrottle, clearLoginFailures, recordLoginFailure } from "./loginThrottle.ts";
import { InvalidPasswordHashError, VerifierBusyError, hashPassword, verifyPassword } from "./password.ts";
import { isSameOriginRequest } from "./requestGuards.ts";
import {
  SESSION_TTL_SECONDS,
  buildClearedSessionCookie,
  buildSessionCookie,
  createSessionToken,
  getSessionKey,
  isAdminSessionValid,
  isSecureRequest,
  readCookie,
  sessionCookieName,
  verifySessionToken,
} from "./session.ts";

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
async function rejects(promise, ErrorType) {
  try {
    await promise;
    return "resolved";
  } catch (error) {
    return error instanceof ErrorType ? "rejected as expected" : `wrong error: ${error}`;
  }
}

const throwawayPassword = randomBytes(9).toString("base64url");
const secret = randomBytes(32).toString("hex");
const originalEnv = { ...process.env };
function resetEnv() {
  for (const key of ["ADMIN_SESSION_SECRET", "ADMIN_PASSWORD_HASH", "SUPABASE_SERVICE_ROLE_KEY", "NODE_ENV"]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

// --- password hashing ---------------------------------------------------------
const hash = await hashPassword(throwawayPassword);
const hashParts = hash.split(":");
check("hash has 6 ':'-separated parts, scrypt first", [hashParts.length, hashParts[0]], [6, "scrypt"]);
check("hash never contains the password", hash.includes(throwawayPassword), false);
check("correct password verifies", await verifyPassword(throwawayPassword, hash), true);
check("wrong password is rejected", await verifyPassword(`${throwawayPassword}x`, hash), false);
check("hashing twice gives different salts", (await hashPassword(throwawayPassword)) === hash, false);
const fullwidthHash = await hashPassword("pass１２３");
check("NFKC-equivalent input verifies (fullwidth digits vs ASCII)", await verifyPassword("pass123", fullwidthHash), true);
check("malformed hash is a configuration error", await rejects(verifyPassword("x", "not-a-hash"), InvalidPasswordHashError), "rejected as expected");
check(
  "out-of-range cost parameters are refused",
  await rejects(verifyPassword("x", `scrypt:8:8:1:${hashParts[4]}:${hashParts[5]}`), InvalidPasswordHashError),
  "rejected as expected"
);
check(
  "a third concurrent verification is refused (memory cap)",
  await (async () => {
    const results = await Promise.allSettled([1, 2, 3].map(() => verifyPassword(throwawayPassword, hash)));
    return results.map((r) => (r.status === "fulfilled" ? "ok" : r.reason instanceof VerifierBusyError ? "busy" : "error"));
  })(),
  ["ok", "ok", "busy"]
);

// --- credentials --------------------------------------------------------------
process.env.ADMIN_PASSWORD_HASH = hash;
check("username + password accepted", await verifyAdminLogin(ADMIN_USERNAME, throwawayPassword), true);
check("wrong username rejected even with right password", await verifyAdminLogin("root", throwawayPassword), false);
check("wrong password rejected", await verifyAdminLogin(ADMIN_USERNAME, "nope"), false);
delete process.env.ADMIN_PASSWORD_HASH;
check("built-in hash is a valid scrypt hash", getAdminPasswordHash().startsWith("scrypt:"), true);
if (process.env.ADMIN_VERIFY_DEFAULT_PASSWORD) {
  check("built-in hash matches ADMIN_VERIFY_DEFAULT_PASSWORD", await verifyPassword(process.env.ADMIN_VERIFY_DEFAULT_PASSWORD, getAdminPasswordHash()), true);
} else {
  console.log("SKIP - built-in hash vs real password (set ADMIN_VERIFY_DEFAULT_PASSWORD to run)");
}

// --- session tokens -----------------------------------------------------------
process.env.ADMIN_PASSWORD_HASH = hash;
process.env.ADMIN_SESSION_SECRET = secret;
const now = Date.now();
const token = createSessionToken(now);
check("token issued when a secret is configured", typeof token, "string");
check("fresh token verifies", verifySessionToken(token, now), true);
check("token still valid just before expiry", verifySessionToken(token, now + (SESSION_TTL_SECONDS - 5) * 1000), true);
check("token expired after the TTL", verifySessionToken(token, now + (SESSION_TTL_SECONDS + 5) * 1000), false);
const [v, exp, nonce, sig] = token.split(".");
check("tampered expiry rejected", verifySessionToken([v, String(Number(exp) + 3600), nonce, sig].join("."), now), false);
// A signature is 32 bytes = 43 base64url characters, and the last one carries only 4 meaningful bits: swapping it for a neighbour
// (A for B, say) can decode to the very same bytes, which is the same signature and rightly verifies. So tamper where it matters:
// a character in the middle, and a last character moved far enough that its meaningful bits change.
check("tampered signature rejected (a middle character)", verifySessionToken([v, exp, nonce, `${sig.slice(0, 10)}${sig[10] === "A" ? "B" : "A"}${sig.slice(11)}`].join("."), now), false);
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
check("tampered signature rejected (the last character moved 16 places on, so its meaningful bits change)", verifySessionToken([v, exp, nonce, `${sig.slice(0, -1)}${B64URL[(B64URL.indexOf(sig.at(-1)) + 16) % 64]}`].join("."), now), false);
check("garbage / empty / oversized tokens rejected", [verifySessionToken("", now), verifySessionToken("a.b.c.d", now), verifySessionToken("x".repeat(400), now), verifySessionToken(null, now)], [false, false, false, false]);
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString("hex");
check("token signed with a different secret rejected", verifySessionToken(token, now), false);
process.env.ADMIN_SESSION_SECRET = secret;
process.env.ADMIN_PASSWORD_HASH = await hashPassword("some other password");
check("changing the password hash invalidates existing sessions", verifySessionToken(token, now), false);
process.env.ADMIN_PASSWORD_HASH = hash;
check("token valid again once the original hash is back", verifySessionToken(token, now), true);

process.env.ADMIN_SESSION_SECRET = "too-short";
check("a too-short ADMIN_SESSION_SECRET disables sessions (no silent fallback)", [getSessionKey(), createSessionToken()], [null, null]);
delete process.env.ADMIN_SESSION_SECRET;
process.env.NODE_ENV = "production";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
check("production with no secret at all fails closed", [getSessionKey(), createSessionToken(), verifySessionToken(token, now)], [null, null, false]);
process.env.SUPABASE_SERVICE_ROLE_KEY = randomBytes(40).toString("hex");
const fallbackToken = createSessionToken(now);
check("falls back to a key derived from the Supabase service key", verifySessionToken(fallbackToken, now), true);
check("...which is not interchangeable with ADMIN_SESSION_SECRET tokens", verifySessionToken(token, now), false);
resetEnv();
process.env.ADMIN_PASSWORD_HASH = hash;
process.env.ADMIN_SESSION_SECRET = secret;

// --- cookies ------------------------------------------------------------------
check("__Host- prefix only on secure", [sessionCookieName(true), sessionCookieName(false)], ["__Host-kp_admin", "kp_admin"]);
check("readCookie finds the named cookie among several", readCookie("a=1; kp_admin=tok.en; b=2", "kp_admin"), "tok.en");
check("readCookie returns null when absent", [readCookie("a=1", "kp_admin"), readCookie(null, "kp_admin")], [null, null]);
check("readCookie does not match a name suffix", readCookie("x__Host-kp_admin=evil", "__Host-kp_admin"), null);
const secureCookie = buildSessionCookie("tok", true);
check("secure cookie is __Host-, HttpOnly, Secure, SameSite=Strict, Path=/, no Domain", [secureCookie.startsWith("__Host-kp_admin=tok;"), ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"].every((a) => secureCookie.includes(a)), secureCookie.includes("Domain")], [true, true, false]);
check("local (http) cookie omits Secure", buildSessionCookie("tok", false).includes("Secure"), false);
check("logout cookie expires immediately", buildClearedSessionCookie(true).includes("Max-Age=0"), true);
check("isAdminSessionValid reads the right cookie name", [isAdminSessionValid(`__Host-kp_admin=${token}`, true), isAdminSessionValid(`kp_admin=${token}`, true), isAdminSessionValid(`kp_admin=${token}`, false)], [true, false, true]);
check("isSecureRequest", [isSecureRequest("https", "http:"), isSecureRequest(undefined, "https:"), isSecureRequest(undefined, "http:"), isSecureRequest("http, https", "https:")], [true, true, false, false]);

// --- login throttle -----------------------------------------------------------
{
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) recordLoginFailure("ip-a", t0 + i);
  check("4 failures do not lock", checkLoginThrottle("ip-a", t0 + 10).locked, false);
  recordLoginFailure("ip-a", t0 + 4);
  const locked = checkLoginThrottle("ip-a", t0 + 1000);
  check("5th failure locks, with a retry time near 15 min", [locked.locked, locked.retryAfterSeconds > 890 && locked.retryAfterSeconds <= 900], [true, true]);
  check("other clients are unaffected", checkLoginThrottle("ip-b", t0 + 1000).locked, false);
  check("lock lifts once the window has passed", checkLoginThrottle("ip-a", t0 + 15 * 60_000 + 10).locked, false);
  recordLoginFailure("ip-c", t0);
  clearLoginFailures("ip-c");
  check("a successful login clears the record", checkLoginThrottle("ip-c", t0).locked, false);
}

// --- host + proxy routing -----------------------------------------------------
check("isAdminHost", [isAdminHost("admin.kopanalys.se"), isAdminHost("ADMIN.kopanalys.se:443"), isAdminHost("admin.localhost:3001"), isAdminHost("admin.kopanalys.se."), isAdminHost("kopanalys.se"), isAdminHost("www.kopanalys.se"), isAdminHost("evil-admin.kopanalys.se"), isAdminHost("admin.kopanalys.se.evil.com"), isAdminHost(null)], [true, true, true, true, false, false, false, false, false]);
const proxyReq = (host, path) => new NextRequest(`http://${host}${path}`, { headers: { host } });
const status = (res) => (res ? res.status : null);
const rewriteTarget = (res) => res?.headers.get("x-middleware-rewrite");
check("admin host: '/' is rewritten to the portal page", rewriteTarget(routeAdminHost(proxyReq("admin.kopanalys.se", "/?x=1"))), "http://admin.kopanalys.se/admin-portal");
check("admin host: login/logout API and _next pass through", ["/api/admin-portal/login", "/api/admin-portal/logout", "/_next/webpack-hmr"].map((p) => routeAdminHost(proxyReq("admin.kopanalys.se", p))?.headers.get("x-middleware-next")), ["1", "1", "1"]);
check("admin host: site pages and other APIs are 404", ["/dashboard", "/report", "/api/chat", "/api/stripe/webhook", "/buy", "/admin-portal"].map((p) => status(routeAdminHost(proxyReq("admin.kopanalys.se", p)))), [404, 404, 404, 404, 404, 404]);
check("main host: portal page, its data route and API are hidden", ["/admin-portal", "/api/admin-portal/login", "/_next/data/abc/admin-portal.json"].map((p) => status(routeAdminHost(proxyReq("kopanalys.se", p)))), [404, 404, 404]);
check("main host: ordinary requests fall through untouched", ["/", "/dashboard", "/api/chat"].map((p) => routeAdminHost(proxyReq("kopanalys.se", p))), [null, null, null]);

// --- request guards -----------------------------------------------------------
const adminHost = "admin.kopanalys.se";
const post = (headers, body = "{}") => new Request(`https://${adminHost}/api/admin-portal/login`, { method: "POST", headers: { host: adminHost, ...headers }, body });
check("same-origin: matching Origin accepted", isSameOriginRequest(post({ origin: `https://${adminHost}` })), true);
check("same-origin: foreign Origin rejected", isSameOriginRequest(post({ origin: "https://evil.example" })), false);
check("same-origin: missing Origin rejected", isSameOriginRequest(post({})), false);
check("same-origin: Sec-Fetch-Site cross-site rejected even with matching Origin", isSameOriginRequest(post({ origin: `https://${adminHost}`, "sec-fetch-site": "cross-site" })), false);

// --- login / logout route handlers -------------------------------------------
const goodHeaders = { origin: `https://${adminHost}`, "content-type": "application/json", "sec-fetch-site": "same-origin" };
const login = (fields, extraHeaders = {}, headers = goodHeaders) =>
  loginPost(post({ ...headers, "x-forwarded-for": "203.0.113.7", "x-forwarded-proto": "https", ...extraHeaders }, JSON.stringify(fields)));
const bodyOf = async (res) => res.json();

check("login on a non-admin host is 404", (await loginPost(new Request("https://kopanalys.se/api/admin-portal/login", { method: "POST", headers: { host: "kopanalys.se", ...goodHeaders }, body: "{}" }))).status, 404);
check("login without Origin is 403", (await loginPost(post({ "content-type": "application/json" }))).status, 403);
check("login with a non-JSON content type is 415", (await loginPost(post({ origin: `https://${adminHost}`, "content-type": "text/plain" }))).status, 415);
check("login with malformed JSON is 400", (await loginPost(post(goodHeaders, "{not json"))).status, 400);
check("login with missing fields is 400", (await login({ username: ADMIN_USERNAME })).status, 400);
check("login with an oversized body is 413", (await loginPost(post(goodHeaders, JSON.stringify({ username: "a", password: "b".repeat(6000) })))).status, 413);

const badLogin = await login({ username: ADMIN_USERNAME, password: "wrong password" }, { "x-forwarded-for": "198.51.100.1" });
check("wrong password is 401 with no cookie", [badLogin.status, (await bodyOf(badLogin)).error, badLogin.headers.get("set-cookie")], [401, "invalid_credentials", null]);
const badUser = await login({ username: "root", password: throwawayPassword }, { "x-forwarded-for": "198.51.100.2" });
check("wrong username with the right password is the same generic 401", [badUser.status, (await bodyOf(badUser)).error], [401, "invalid_credentials"]);

const goodLogin = await login({ username: ADMIN_USERNAME, password: throwawayPassword }, { "x-forwarded-for": "198.51.100.3" });
const setCookie = goodLogin.headers.get("set-cookie") ?? "";
check("correct credentials: 200", [goodLogin.status, (await bodyOf(goodLogin)).ok], [200, true]);
check("session cookie is __Host-, HttpOnly, Secure, SameSite=Strict", ["__Host-kp_admin=", "HttpOnly", "Secure", "SameSite=Strict", "Path=/"].every((part) => setCookie.includes(part)), true);
const issuedToken = /__Host-kp_admin=([^;]+)/.exec(setCookie)?.[1];
check("the issued cookie is a valid session", verifySessionToken(issuedToken), true);
check("the response is never cacheable", goodLogin.headers.get("cache-control"), "no-store");

{
  // lock-out after repeated failures from one client, then no scrypt work at all
  const ip = { "x-forwarded-for": "198.51.100.99" };
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await login({ username: ADMIN_USERNAME, password: `guess ${i}` }, ip)).status);
  check("5 failures then 429 for that client", codes, [401, 401, 401, 401, 401, 429]);
  const locked = await login({ username: ADMIN_USERNAME, password: throwawayPassword }, ip);
  check("even the right password is refused while locked, with Retry-After", [locked.status, Number(locked.headers.get("retry-after")) > 0], [429, true]);
  const otherClient = await login({ username: ADMIN_USERNAME, password: throwawayPassword }, { "x-forwarded-for": "198.51.100.100" });
  check("another client can still log in", otherClient.status, 200);
}

{
  const outcome = async (env) => {
    for (const key of ["ADMIN_SESSION_SECRET", "ADMIN_PASSWORD_HASH", "SUPABASE_SERVICE_ROLE_KEY", "NODE_ENV"]) delete process.env[key];
    Object.assign(process.env, env);
    const res = await login({ username: ADMIN_USERNAME, password: throwawayPassword }, { "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 200)}` });
    return [res.status, (await bodyOf(res)).error ?? "ok"];
  };
  check("production without any session secret: login 503 not_configured", await outcome({ NODE_ENV: "production", ADMIN_PASSWORD_HASH: hash }), [503, "not_configured"]);
  check("a garbage ADMIN_PASSWORD_HASH: login 503 not_configured", await outcome({ NODE_ENV: "production", ADMIN_SESSION_SECRET: secret, ADMIN_PASSWORD_HASH: "garbage" }), [503, "not_configured"]);
  check("production with the secret and a real hash: login works", await outcome({ NODE_ENV: "production", ADMIN_SESSION_SECRET: secret, ADMIN_PASSWORD_HASH: hash }), [200, "ok"]);
  resetEnv();
  process.env.ADMIN_PASSWORD_HASH = hash;
  process.env.ADMIN_SESSION_SECRET = secret;
}

const logout = await logoutPost(post({ origin: `https://${adminHost}`, "content-type": "application/json", "x-forwarded-proto": "https" }));
check("logout clears the cookie", [logout.status, (logout.headers.get("set-cookie") ?? "").includes("Max-Age=0")], [200, true]);
check("logout requires same-origin", (await logoutPost(post({ origin: "https://evil.example" }))).status, 403);

resetEnv();
console.log(failures === 0 ? "\nAll admin auth checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
