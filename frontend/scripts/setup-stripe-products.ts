import Stripe from "stripe";
import * as fs from "fs";
import * as path from "path";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
  typescript: true,
});

const PRODUCTS = [
  {
    name: "Premium Beslutsanalys",
    description: "En komplett Premium Decision Analysis för en bostad.",
    envVar: "STRIPE_PRICE_PREMIUM_ANALYSIS",
    prices: [{ currency: "sek", amount: 7900, type: "one_time" as const }],
  },
  {
    name: "Premium (månad)",
    description: "15 Premium Decision Analyses/månad + premiumfunktioner.",
    envVar: "STRIPE_PRICE_PREMIUM_MONTHLY",
    prices: [{ currency: "sek", amount: 15900, type: "recurring" as const, interval: "month" as const }],
  },
  {
    name: "Ultra (månad)",
    description: "30 Premium Decision Analyses/månad + alla premiumfunktioner.",
    envVar: "STRIPE_PRICE_ULTRA_MONTHLY",
    prices: [{ currency: "sek", amount: 29900, type: "recurring" as const, interval: "month" as const }],
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
        ...(priceDef.type === "recurring"
          ? { recurring: { interval: priceDef.interval } }
          : {}),
      });
      const label = priceDef.type === "recurring"
        ? `${priceDef.amount / 100} ${priceDef.currency.toUpperCase()}/${priceDef.interval}`
        : `${priceDef.amount / 100} ${priceDef.currency.toUpperCase()}`;
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
