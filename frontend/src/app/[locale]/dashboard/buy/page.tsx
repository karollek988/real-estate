import { redirect } from "@/i18n/navigation";
import { pageLocale, type LocaleParams } from "@/i18n/page";

export default async function BuyPageRedirect({
  params,
  searchParams,
}: LocaleParams & {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const locale = await pageLocale(params);
  const { checkout } = await searchParams;
  redirect({ href: checkout ? { pathname: "/buy", query: { checkout } } : "/buy", locale });
}
