// Standalone verification for listing/hemnetPage.ts's extraction pipeline
// (no test framework in this project - see identityTrust.verify.mjs). Run with:
//   node --experimental-strip-types src/lib/analysis/listing/hemnetPage.verify.mjs
//
// The fixtures below mirror the *real* structure of a Hemnet listing page as
// of 2026-07 (confirmed by fetching live listings directly): a server-rendered
// `<script id="__NEXT_DATA__">` whose `props.pageProps.__APOLLO_STATE__` is a
// normalized GraphQL cache — a flat `"<Type>:<id>"`-keyed dict with
// `{ __ref }` cross-references and typed `Money`/`HousingForm`/`Tenure`
// sub-objects — plus a thin `Product`-typed JSON-LD block. All content below
// (names, address, broker, BRF) is fabricated; only the shape is real.
//
// This replaces an earlier version of this fixture that modeled a flat
// `window.__NEXT_DATA__ = { livingArea, monthlyFee, ... }` object with no
// Apollo cache, refs, or Money wrappers — that shape does not occur on
// Hemnet and the extraction pipeline it was written against only recovered
// 5 of 32 fields from a real listing page, which is what prompted this
// rewrite.
import { parseHemnetHtml } from "./hemnetPage.ts";

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

const FULL_DESCRIPTION =
  "Accepterat pris - ring för visning!\n\n- Sluten innergård\n- Nära till tåget\n\n" +
  "Välkommen till denna ljusa och fina lägenhet med öppen planlösning mellan kök och vardagsrum. " +
  "Föreningen har god ekonomi och inga planerade avgiftshöjningar de kommande åren.";

const APOLLO_STATE = {
  "ActivePropertyListing:99999999": {
    __typename: "ActivePropertyListing",
    id: "99999999",
    streetAddress: "Testvägen 1",
    listingHemnetUrl: "https://www.hemnet.se/bostad/lagenhet-3rum-testvagen-1-99999999",
    askingPrice: { __typename: "Money", amount: 4500000, formatted: "4 500 000 kr" },
    squareMeterPrice: { __typename: "Money", amount: 66176, formatted: "66 176 kr/m²" },
    fee: { __typename: "Money", amount: 4200, formatted: "4 200 kr" },
    runningCosts: { __typename: "Money", amount: 350, formatted: "350 kr" },
    livingArea: 68,
    supplementalArea: 5,
    landArea: null,
    legacyConstructionYear: "1932",
    energyClassification: { __typename: "EnergyClassification", classification: "C" },
    numberOfRooms: 3,
    formattedFloor: "3 av 5, hiss finns",
    housingForm: { __typename: "HousingForm", name: "Lägenhet" },
    tenure: { __typename: "Tenure", name: "Bostadsrätt" },
    publishedAt: "1782806400",
    isNewConstruction: true,
    description: FULL_DESCRIPTION,
    broker: { __ref: "Broker:1" },
    brokerAgency: { __ref: "BrokerAgency:1" },
    brf: { __ref: 'Brf:{"registrationNumber":"1234567890"}' },
    relevantAmenities: [
      { __typename: "BalconyAmenity", kind: "BALCONY", isAvailable: true, title: "Balkong" },
      { __typename: "ElevatorAmenity", kind: "ELEVATOR", isAvailable: true, title: "Hiss" },
      { __typename: "GarageAmenity", kind: "GARAGE", isAvailable: true, title: "Garage" },
      { __typename: "StorageAmenity", kind: "STORAGE", isAvailable: true, title: "Förråd" },
      { __typename: "PatioAmenity", kind: "PATIO", isAvailable: false, title: "Uteplats" },
      { __typename: "FireplaceAmenity", kind: "FIREPLACE", isAvailable: true, title: "Öppen spis" },
    ],
    // Real Hemnet listings carry the same feature information a second time
    // in `labels` (the chips rendered on the page) — this is what actually
    // fills PARKING here, since relevantAmenities above has no PARKING entry
    // at all (labels only ever assert presence, never override an explicit
    // isAvailable: false from relevantAmenities, e.g. PATIO stays false).
    // "Inflyttningsklar" has no Amenity representation anywhere and only
    // exists as a label — it must land in `features`, not a boolean.
    labels: [
      { __typename: "Label", identifier: "PARKING", category: "FEATURE", text: "Parkering" },
      { __typename: "Label", identifier: "PATIO", category: "FEATURE", text: "Uteplats" },
      { __typename: "Label", identifier: "OCCUPANCY", category: "FEATURE", text: "Inflyttningsklar" },
      { __typename: "Label", identifier: "MAX", category: "PRODUCT", text: "Max" },
    ],
    "images({\"limit\":300})": {
      __typename: "ListingImageResults",
      images: [
        { __typename: "ListingImage", labels: [], 'url({"format":"ITEMGALLERY_CUT"})': "https://bilder.hemnet.se/images/photo1.jpg" },
        { __typename: "ListingImage", labels: [], 'url({"format":"ITEMGALLERY_CUT"})': "https://bilder.hemnet.se/images/photo2.jpg" },
        // Real Hemnet listings return floor plans inside this same gallery
        // array, distinguished only by this label — floorPlanImages below
        // points at the same photos but (verified on real listings, 2026-07)
        // is queried without url(), so it never actually resolves a URL.
        { __typename: "ListingImage", labels: ["FLOOR_PLAN"], 'url({"format":"ITEMGALLERY_CUT"})': "https://bilder.hemnet.se/images/floorplan1.png" },
      ],
    },
    floorPlanImages: [
      { __typename: "ListingImage", labels: ["FLOOR_PLAN"] },
    ],
  },
  "Broker:1": { __typename: "Broker", name: "Anna Andersson" },
  "BrokerAgency:1": { __typename: "BrokerAgency", name: "Fastighetsbyrån Stockholm" },
  'Brf:{"registrationNumber":"1234567890"}': {
    __typename: "Brf",
    registrationNumber: "1234567890",
    name: "Brf Solkatten",
  },
};

const FIXTURE_HTML = `
<html>
<head>
<meta property="og:image" content="https://bilder.hemnet.se/images/og.jpg"/>
</head>
<body>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Testvägen 1",
  "description": "Accepterat pris - ring för visning! Ljus lägenhet nära tåget.",
  "image": "https://bilder.hemnet.se/images/og.jpg",
  "offers": { "@type": "Offer", "priceCurrency": "SEK", "price": 4500000 },
  "mpn": "99999999",
  "brand": { "@type": "Organization", "name": "Fastighetsbyrån Stockholm" }
}
</script>
<script id="__NEXT_DATA__" type="application/json">
${JSON.stringify({ props: { pageProps: { __APOLLO_STATE__: APOLLO_STATE } } })}
</script>
</body>
</html>
`;

const parsed = parseHemnetHtml(FIXTURE_HTML);

check("asking price from Apollo state (Money.amount)", parsed.asking_price_sek, 4500000);
check("price per m² from Apollo state", parsed.price_per_m2_sek, 66176);
check("living area from Apollo state", parsed.living_area_m2, 68);
check("additional area from Apollo state", parsed.additional_area_m2, 5);
check("monthly fee from Apollo state", parsed.monthly_fee_sek, 4200);
check("operating costs from Apollo state", parsed.operating_costs_sek, 350);
check("building year from Apollo state (legacyConstructionYear)", parsed.building_year, 1932);
check("construction year mirrors building year", parsed.construction_year, 1932);
check("energy class from Apollo state (nested classification)", parsed.energy_class, "C");
check("rooms from Apollo state", parsed.rooms, 3);
check("floor from Apollo state (formattedFloor)", parsed.floor, "3 av 5, hiss finns");
check("property type from Apollo state (housingForm.name)", parsed.property_type, "Lägenhet");
check("ownership type from Apollo state (tenure.name)", parsed.ownership_type, "Bostadsrätt");
check("listing date from Apollo state (publishedAt unix seconds)", parsed.listing_date, new Date(1782806400 * 1000).toISOString());
check("object id from Apollo state", parsed.object_id, "99999999");
check("broker resolved through __ref", parsed.broker, "Anna Andersson");
check("agency resolved through __ref", parsed.agency, "Fastighetsbyrån Stockholm");
check("housing association resolved through brf __ref (composite key)", parsed.housing_association, "Brf Solkatten");
check("balcony from relevantAmenities", parsed.balcony, true);
check("elevator from relevantAmenities", parsed.elevator, true);
check("garage from relevantAmenities", parsed.garage, true);
check("storage from relevantAmenities", parsed.storage, true);
check("patio explicitly false from relevantAmenities wins over labels' PATIO presence", parsed.patio, false);
check("parking filled from a FEATURE label when relevantAmenities has no PARKING entry at all", parsed.parking, true);
check("condition inferred from isNewConstruction", parsed.condition, "Nyproduktion");
check(
  "features combine an unmapped amenity kind (fireplace) and an unmapped FEATURE label (move-in-ready), deduped against boolean-backed labels",
  parsed.features,
  ["Öppen spis", "Inflyttningsklar"]
);
check(
  "description prefers Apollo's full text over the JSON-LD teaser",
  parsed.description,
  FULL_DESCRIPTION
);
check("images collected from Apollo's parameterized images() field, floor plan excluded by its label", parsed.image_urls, [
  "https://bilder.hemnet.se/images/photo1.jpg",
  "https://bilder.hemnet.se/images/photo2.jpg",
  "https://bilder.hemnet.se/images/og.jpg",
]);
check(
  "floorplan image routed out of the images() gallery by its FLOOR_PLAN label (floorPlanImages itself carries no url())",
  parsed.floorplan_urls,
  ["https://bilder.hemnet.se/images/floorplan1.png"]
);

// A second fixture: no Apollo state at all (e.g. a template variant, or a
// future page where it's absent) — the pipeline must still recover data from
// JSON-LD and semantic HTML alone, proving neither later source silently
// depends on Apollo being present.
const ARRAY_FIXTURE_HTML = `
<html>
<head></head>
<body>
<script type="application/ld+json">
[
  {
    "@type": "RealEstateListing",
    "name": "Rymlig villa",
    "yearBuilt": 1965,
    "floorSize": { "@type": "QuantitativeValue", "value": 142 },
    "offers": { "price": 6900000 }
  }
]
</script>
<dl>
  <dt>Boendeform</dt>
  <dd>Villa</dd>
  <dt>Pris per kvadratmeter</dt>
  <dd>48 592 kr</dd>
  <dt>Utgångspris</dt>
  <dd>6 900 000 kr</dd>
</dl>
<h2>Om huset</h2>
<p>Rymlig villa i lugnt villaområde med stor trädgård och nybyggt garage. Nära till skola, dagis och pendeltåg, cirka tio minuters promenad till centrum.</p>
<h2>Om området</h2>
<p>Ett barnvänligt område med gångavstånd till både skola och natur.</p>
</body>
</html>
`;

const arrayParsed = parseHemnetHtml(ARRAY_FIXTURE_HTML);

check("asking price from a bare top-level JSON-LD array (no Apollo state)", arrayParsed.asking_price_sek, 6900000);
check("building year from JSON-LD yearBuilt (schema.org Residence field)", arrayParsed.building_year, 1965);
check("living area from JSON-LD floorSize QuantitativeValue", arrayParsed.living_area_m2, 142);
check("property type from dt/dd pair, matched by tag not class name", arrayParsed.property_type, "Villa");
check("price per m² from dt/dd pair, not conflated with asking price", arrayParsed.price_per_m2_sek, 48592);
check("asking price from dt/dd is unaffected by the price-per-m² row", arrayParsed.asking_price_sek, 6900000);
check(
  "description falls back to the semantic 'Om huset' heading section, stopping before the next heading",
  arrayParsed.description,
  "Rymlig villa i lugnt villaområde med stor trädgård och nybyggt garage. Nära till skola, dagis och pendeltåg, cirka tio minuters promenad till centrum."
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
