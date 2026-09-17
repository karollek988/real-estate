// Proof-of-concept: hämta livingArea, supplementalArea och housingForm
// direkt från Hemnets publika GraphQL-endpoint, för EN annons i taget.
//
// Använder bara Node.js inbyggda fetch. Inga cookies, API-nycklar,
// Cloudflare-bypass, proxy eller inloggningsuppgifter skickas med —
// vi vill se exakt vad en helt vanlig POST-request ger för svar.
//
// Körning:
//   node scripts/hemnet-graphql-poc.mjs <hemnet-url-eller-id> [<hemnet-url-eller-id-2> ...]

const HEMNET_GRAPHQL_URL = "https://www.hemnet.se/graphql";

const LISTING_CALCULATORS_QUERY = `
  query webListingCalculators($id: ID!) {
    listing(id: $id) {
      id
      livingArea
      supplementalArea
      housingForm {
        symbol
        name
      }
    }
  }
`;

function extractListingId(input) {
  const trimmed = input.trim();

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Hemnet-URL:er slutar med annons-ID:t, t.ex.
  // .../lagenhet-3rum-vasastan-goteborgs-kommun-vasagatan-21717726
  const match = trimmed.match(/(\d{5,})\/?(?:[?#].*)?$/);
  if (!match) {
    throw new Error(`Hittade inget annons-ID i "${input}"`);
  }
  return match[1];
}

async function queryListingCalculators(listingId) {
  const response = await fetch(HEMNET_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      operationName: "webListingCalculators",
      query: LISTING_CALCULATORS_QUERY,
      variables: { id: listingId },
    }),
    credentials: "omit",
  });

  const rawText = await response.text();

  let json = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    // Svaret var inte JSON (t.ex. en Cloudflare-blockeringssida på HTML).
    // json förblir null, och rawText rapporteras istället nedan.
  }

  return { status: response.status, json, rawText };
}

function reportResult(listingId, { status, json, rawText }) {
  console.log(`\n=== Annons-ID ${listingId} ===`);
  console.log(`HTTP-status: ${status}`);

  if (!json) {
    console.log("Svaret kunde inte tolkas som JSON (requesten blockerades sannolikt).");
    console.log("Råsvar (första 500 tecken):");
    console.log(rawText.slice(0, 500));
    return;
  }

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    console.log("GraphQL-fel:");
    for (const error of json.errors) {
      console.log(`  - ${error.message}`);
    }
  }

  const listing = json.data?.listing;
  if (!listing) {
    console.log("Inget listing-objekt i svaret.");
    return;
  }

  console.log("Resultat:");
  console.log(`  id:               ${listing.id}`);
  console.log(`  livingArea:       ${listing.livingArea}`);
  console.log(`  supplementalArea: ${listing.supplementalArea}`);
  console.log(
    `  housingForm:      ${
      listing.housingForm ? `${listing.housingForm.name} (${listing.housingForm.symbol})` : "null"
    }`
  );
}

async function main() {
  const inputs = process.argv.slice(2);

  if (inputs.length === 0) {
    console.log("Användning:");
    console.log("  node scripts/hemnet-graphql-poc.mjs <hemnet-url-eller-id> [fler...]\n");
    console.log("Exempel:");
    console.log("  node scripts/hemnet-graphql-poc.mjs https://www.hemnet.se/bostad/lagenhet-...-21717726");
    console.log("  node scripts/hemnet-graphql-poc.mjs 21717726 34823920");
    process.exitCode = 1;
    return;
  }

  for (const input of inputs) {
    try {
      const listingId = extractListingId(input);
      const result = await queryListingCalculators(listingId);
      reportResult(listingId, result);
    } catch (error) {
      console.log(`\nFel för indata "${input}": ${error.message}`);
    }
  }
}

main();
