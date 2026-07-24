import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
  typescript: true,
});

const PRODUCTS = [
  {
    name: "Premium Beslutsanalys",
    description: "En komplett Premium Decision Analysis för en bostad.",
    prices: [{ currency: "sek", amount: 7900, type: "one_time" as const }],
  },
  {
    name: "Premium (månad)",
    description: "15 Premium Decision Analyses/månad + premiumfunktioner.",
    prices: [{ currency: "sek", amount: 15900, type: "recurring" as const, interval: "month" as const }],
  },
  {
    name: "Ultra (månad)",
    description: "30 Premium Decision Analyses/månad + alla premiumfunktioner.",
    prices: [{ currency: "sek", amount: 29900, type: "recurring" as const, interval: "month" as const }],
  },
];

async function main() {
  console.log("Creating Stripe products and prices...\n");

  for (const product of PRODUCTS) {
    const existing = await stripe.products.list({
      active: true,
      limit: 100,
    });

    const match = existing.data.find(
      (p) => p.name.toLowerCase() === product.name.toLowerCase()
    );

    if (match) {
      console.log(`✓ Product "${product.name}" already exists: ${match.id}`);
      const prices = await stripe.prices.list({ product: match.id, active: true, limit: 10 });
      for (const price of prices.data) {
        console.log(`  Price: ${price.id} — ${price.unit_amount! / 100} ${price.currency.toUpperCase()}${price.type === "recurring" ? ` / ${(price.recurring as { interval: string }).interval}` : ""}`);
        printEnvVar(product.name, price.id);
      }
      continue;
    }

    const created = await stripe.products.create({
      name: product.name,
      description: product.description,
    });
    console.log(`✓ Product "${product.name}" created: ${created.id}`);

    for (const priceDef of product.prices) {
      const price = await stripe.prices.create({
        product: created.id,
        currency: priceDef.currency,
        unit_amount: priceDef.amount,
        ...(priceDef.type === "recurring"
          ? { recurring: { interval: priceDef.interval } }
          : {}),
      });
      console.log(`  Price: ${price.id} — ${price.unit_amount! / 100} ${price.currency.toUpperCase()}${priceDef.type === "recurring" ? ` / ${priceDef.interval}` : ""}`);
      printEnvVar(product.name, price.id);
    }
    console.log("");
  }

  console.log("\nDone! Copy the STRIPE_PRICE_* lines above into your .env.local");
}

function printEnvVar(productName: string, priceId: string) {
  const key = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const varName = `STRIPE_PRICE_${key}`;
  console.log(`  → ${varName}=${priceId}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
