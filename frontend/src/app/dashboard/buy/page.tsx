import { redirect } from "next/navigation";

export default async function BuyPageRedirect({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  redirect(checkout ? `/buy?checkout=${checkout}` : "/buy");
}
