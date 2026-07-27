import { NextResponse } from "next/server";
import { getHousingMarketNews } from "@/lib/news/fetchNews";

export const revalidate = 1800;

export async function GET() {
  const items = await getHousingMarketNews();
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } },
  );
}
