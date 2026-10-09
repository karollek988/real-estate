// Standalone verification for the PDF route's helpers (lib/analysis/pdfRender.ts): the session cookies given to
// the headless browser must be cookies of this site only, and URLs written to the log must carry no query string.
// No test framework in this project (see the other *.verify.mjs). Run with:
//   npx tsx src/lib/analysis/pdfRender.verify.mjs
import { cookiesForOrigin, shortUrl } from "./pdfRender.ts";

let failures = 0;
function check(name, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) {
    failures++;
    if (detail !== undefined) console.log("  detail:", detail);
  }
}

const ORIGIN = "https://kopanalys.se";

const plain = cookiesForOrigin("sb-abc-auth-token=base64-eyJhIjoxfQ; other=1", ORIGIN);
check("each cookie of the request becomes one cookie", plain.length === 2 && plain[0].name === "sb-abc-auth-token" && plain[1].name === "other", plain);
check("every cookie is scoped to the site's own origin (so it is never sent to another host)", plain.every((c) => c.url === ORIGIN && c.domain === undefined), plain);
check("a value is kept exactly as received", plain[0].value === "base64-eyJhIjoxfQ", plain[0]);

const withEquals = cookiesForOrigin("token=a=b==; x=y", ORIGIN);
check("'=' inside a value stays in the value", withEquals[0].name === "token" && withEquals[0].value === "a=b==", withEquals);

const chunked = cookiesForOrigin("sb-abc-auth-token.0=aaa; sb-abc-auth-token.1=bbb", ORIGIN);
check("a session split over two cookies keeps both parts", chunked.map((c) => c.name).join() === "sb-abc-auth-token.0,sb-abc-auth-token.1", chunked);

check("no cookie header means no cookies", cookiesForOrigin(null, ORIGIN).length === 0 && cookiesForOrigin("", ORIGIN).length === 0);
check("garbage without '=' or a name is skipped", cookiesForOrigin("novalue; =x; ;", ORIGIN).length === 0);
check("whitespace around pairs is ignored", cookiesForOrigin("  a=1 ;b=2  ", ORIGIN).map((c) => `${c.name}=${c.value}`).join() === "a=1,b=2");

check("a logged URL has host and path but no query string", shortUrl("https://img.example.com/photo/123.jpg?token=SECRET") === "img.example.com/photo/123.jpg");
check("a very long path is cut", shortUrl("https://h.example/" + "a".repeat(200)).length <= "h.example".length + 41);
check("something that is not a URL does not throw", typeof shortUrl("not a url ?x=1") === "string");

process.exit(failures === 0 ? 0 : 1);
