import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { legalRich } from "@/components/legal/legalRich";
import { ROUTES } from "@/components/site/navigation";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "legal.terms.meta" });
  return pageMetadata(locale, ROUTES.villkor, { title: t("title"), description: t("description") });
}

type RichTranslator = { rich(key: string, tags: typeof legalRich): React.ReactNode };

/** One numbered clause. The numbers are counted by the page's CSS, so the clauses can be reordered without renumbering. */
function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="[counter-increment:section]">
      <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-ka-ink before:content-[counter(section)'.__']">{title}</h2>
      {children}
    </li>
  );
}

/** The terms of use. Their words are in the "legal.terms" messages; the Swedish text is the one that applies. */
export default async function TermsPage({ params }: LocaleParams) {
  const locale = await pageLocale(params);
  const t = await getTranslations("legal");
  const rich = (key: string) => (t as unknown as RichTranslator).rich(`terms.${key}`, legalRich);

  return (
    <>
      <SiteHeader variant="light" />
      <main id="main" className="min-h-screen bg-ka-cream">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-ka-ink sm:text-[36px]">{t("terms.title")}</h1>
          {locale !== "sv" && (
            <p className="mt-4 rounded-md border border-ka-line-strong bg-ka-cream px-4 py-3 text-[14px] leading-relaxed text-ka-text">
              {t("translationNotice")}
            </p>
          )}

          <ol className="mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-ka-text [counter-reset:section]">
            <Clause title={t("terms.service.title")}>
              <p>{rich("service.text")}</p>
            </Clause>

            <Clause title={t("terms.account.title")}>
              <p>{t("terms.account.text")}</p>
            </Clause>

            <Clause title={t("terms.credits.title")}>
              <p>{t("terms.credits.p1")}</p>
              <p className="mt-3">{t("terms.credits.p2")}</p>
            </Clause>

            <Clause title={t("terms.ip.title")}>
              <p>{t("terms.ip.text")}</p>
            </Clause>

            <Clause title={t("terms.termination.title")}>
              <p>{t("terms.termination.text")}</p>
            </Clause>

            <Clause title={t("terms.law.title")}>
              <p>{t("terms.law.text")}</p>
            </Clause>

            <Clause title={t("terms.contact.title")}>
              <p>{rich("contact.text")}</p>
            </Clause>

            <Clause title={t("terms.liability.title")}>
              <p className="text-xs text-ka-muted">{t("terms.liability.text")}</p>
            </Clause>
          </ol>
        </div>
      </main>
    </>
  );
}
