// Standalone verification for apollo.ts's nearby-sold-comparables extraction
// (similarSaleCards) — no test framework in this project, see
// lib/analysis/identityTrust.verify.mjs for the established pattern. The
// Apollo cache fixture below is trimmed from a real Hemnet listing page
// (Flygkårsvägen 33C, Täby kommun) captured live on 2026-08-14, so this
// checks the parser against Hemnet's actual field shapes/formatting, not a
// guessed one. Run with:
//   node --experimental-strip-types src/lib/analysis/listing/hemnetExtract/apollo.verify.mjs
import { extractApollo } from "./apollo.ts";

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

function htmlWithApolloState(apolloState) {
  return `<!doctype html><html><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { __APOLLO_STATE__: apolloState } } })}</script>
</body></html>`;
}

/* -- nearby sold comparables present (similarSaleCards) -- */
{
  const apolloState = {
    "ActivePropertyListing:21702531": {
      __typename: "ActivePropertyListing",
      id: "21702531",
      streetAddress: "Flygkårsvägen 33C",
      askingPrice: { amount: 3500000 },
      'similarSaleCards({"limit":10})': [
        { __ref: "SaleCard:7137495625920110061" },
        { __ref: "SaleCard:441111126025970578" },
      ],
    },
    "SaleCard:7137495625920110061": {
      __typename: "SaleCard",
      id: "7137495625920110061",
      streetAddress: "Flygkårsvägen 7",
      soldAt: "1780039800.0",
      finalPrice: "3 395 000 kr",
      squareMeterPrice: "37 104 kr/m²",
      livingArea: "91,5 m²",
      rooms: "4 rum",
    },
    "SaleCard:441111126025970578": {
      __typename: "SaleCard",
      id: "441111126025970578",
      streetAddress: "Flygkårsvägen 5",
      soldAt: "1772044200.0",
      finalPrice: "2 995 000 kr",
      squareMeterPrice: "31 660 kr/m²",
      livingArea: "94,6 m²",
      rooms: "4 rum",
    },
    ROOT_QUERY: {
      __typename: "Query",
      'listing({"id":"21702531"})': { __ref: "ActivePropertyListing:21702531" },
    },
  };

  const result = extractApollo(htmlWithApolloState(apolloState));

  check("extracted 2 nearby sold comparables", result.nearby_sold_comparables.length, 2);
  check("comparable address extracted", result.nearby_sold_comparables[0].address, "Flygkårsvägen 7");
  check("comparable sold price parsed from Swedish-formatted string", result.nearby_sold_comparables[0].soldPriceSek, 3395000);
  check("comparable price/m2 parsed", result.nearby_sold_comparables[0].pricePerM2Sek, 37104);
  check("comparable living area parsed (comma decimal)", result.nearby_sold_comparables[0].livingAreaM2, 91.5);
  check("comparable room count parsed", result.nearby_sold_comparables[0].rooms, 4);
  check(
    "comparable sold date converted from Unix-seconds string to YYYY-MM-DD",
    result.nearby_sold_comparables[0].soldDate,
    new Date(1780039800000).toISOString().slice(0, 10)
  );
  check("second comparable address extracted", result.nearby_sold_comparables[1].address, "Flygkårsvägen 5");
}

/* -- no similarSaleCards field on the listing -- */
{
  const apolloState = {
    "ActivePropertyListing:1": {
      __typename: "ActivePropertyListing",
      id: "1",
      streetAddress: "Testgatan 1",
      askingPrice: { amount: 1000000 },
    },
    ROOT_QUERY: { __typename: "Query", 'listing({"id":"1"})': { __ref: "ActivePropertyListing:1" } },
  };
  const result = extractApollo(htmlWithApolloState(apolloState));
  check("no similarSaleCards field -> empty array, not a crash", result.nearby_sold_comparables, []);
}

/* -- a stale/broken ref that resolves to nothing -- */
{
  const apolloState = {
    "ActivePropertyListing:1": {
      __typename: "ActivePropertyListing",
      id: "1",
      streetAddress: "Testgatan 1",
      askingPrice: { amount: 1000000 },
      'similarSaleCards({"limit":10})': [{ __ref: "SaleCard:missing" }],
    },
    ROOT_QUERY: { __typename: "Query", 'listing({"id":"1"})': { __ref: "ActivePropertyListing:1" } },
  };
  const result = extractApollo(htmlWithApolloState(apolloState));
  check("a ref that doesn't resolve is skipped, not a crash", result.nearby_sold_comparables, []);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
