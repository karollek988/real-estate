import Stripe from "stripe";
import * as fs from "fs";
import * as path from "path";
import { OMRADESANALYS_PRICE_SEK, TRE_BOSTADER_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK } from "../src/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
  typescript: true,
});

// The three one-time packages that are sold (see lib/stripe/prices.ts for what
// each purchase credits). Amounts come from lib/pricing.ts so the Stripe Price
// and the price shown on the site can't drift apart; Stripe amounts are in
// öre. Run once per Stripe account — an existing product with the same name is
// reused, not duplicated. Subscriptions are no longer sold, so none are
// created here.
const PRODUCTS = [
  {
    name: "Områdesanalys",
    description: "En analys av området runt en bostad: service, skolor, pendling och trygghet.",
    envVar: "STRIPE_PRICE_OMRADESANALYS",
    prices: [{ currency: "sek", amount: OMRADESANALYS_PRICE_SEK * 100, type: "one_time" as const }],
  },
  {
    name: "Trygghetspaketet",
    description: "Den fullständiga analysen av en bostad: BRF-analys, områdesanalys och dolda kostnader.",
    envVar: "STRIPE_PRICE_TRYGGHETSPAKET",
    prices: [{ currency: "sek", amount: TRYGGHETSPAKET_PRICE_SEK * 100, type: "one_time" as const }],
  },
  {
    name: "Tre bostäder",
    description: "Trygghetspaketet för tre bostäder.",
    envVar: "STRIPE_PRICE_TRE_BOSTADER",
    prices: [{ currency: "sek", amount: TRE_BOSTADER_PRICE_SEK * 100, type: "one_time" as const }],
  },
];

async function main() {
  console.log("[Stripe Setup] Creating products and prices...\n");

  const allProducts = await stripe.products.list({ active: true, limit: 100 });
  const allPrices = await stripe.prices.list({ active: true, limit: 100 });

  const envEntries: string[] = [];

  for (const product of PRODUCTS) {
    const match = allProducts.data.find(
      (p) => p.name.toLowerCase() === product.name.toLowerCase()
    );

    if (match) {
      console.log(`[Stripe Setup] ✓ Product "${product.name}" exists: ${match.id}`);
      const matchingPrices = allPrices.data.filter((p) => p.product === match.id);
      if (matchingPrices.length > 0) {
        for (const price of matchingPrices) {
          const label = price.type === "recurring"
            ? `${price.unit_amount! / 100} ${price.currency.toUpperCase()}/mån`
            : `${price.unit_amount! / 100} ${price.currency.toUpperCase()}`;
          console.log(`[Stripe Setup]   Price: ${price.id} — ${label}`);
          envEntries.push(`${product.envVar}=${price.id}`);
        }
        continue;
      }
    }

    console.log(`[Stripe Setup] Creating product "${product.name}"...`);
    const created = await stripe.products.create({
      name: product.name,
      description: product.description,
    });
    console.log(`[Stripe Setup] ✓ Product created: ${created.id}`);

    for (const priceDef of product.prices) {
      const price = await stripe.prices.create({
        product: created.id,
        currency: priceDef.currency,
        unit_amount: priceDef.amount,
      });
      const label = `${priceDef.amount / 100} ${priceDef.currency.toUpperCase()}`;
      console.log(`[Stripe Setup] ✓ Price created: ${price.id} — ${label}`);
      envEntries.push(`${product.envVar}=${price.id}`);
    }
    console.log("");
  }

  const envPath = path.resolve(process.cwd(), ".env.local");
  let envContent = fs.readFileSync(envPath, "utf-8");

  const addedKeys: string[] = [];
  const updatedKeys: string[] = [];

  for (const entry of envEntries) {
    const [key, value] = entry.split("=", 2);
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
      updatedKeys.push(key);
    } else {
      envContent += envContent.endsWith("\n") ? `${key}=${value}` : `\n${key}=${value}`;
      addedKeys.push(key);
    }
  }

  fs.writeFileSync(envPath, envContent);

  if (updatedKeys.length > 0) {
    console.log(`[Stripe Setup] ✓ Updated in .env.local: ${updatedKeys.join(", ")}`);
  }
  if (addedKeys.length > 0) {
    console.log(`[Stripe Setup] ✓ Added to .env.local: ${addedKeys.join(", ")}`);
  }

  console.log("\n[Stripe Setup] ✓ Done");
}

main().catch((err) => {
  console.error("[Stripe Setup] ✗ Failed:", err.message);
  process.exit(1);
});
