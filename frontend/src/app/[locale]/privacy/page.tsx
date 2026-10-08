import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { legalRich } from "@/components/legal/legalRich";
import { ROUTES } from "@/components/site/navigation";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "legal.privacy.meta" });
  return pageMetadata(locale, ROUTES.integritetspolicy, { title: t("title"), description: t("description") });
}

type RichTranslator = { rich(key: string, tags: typeof legalRich): React.ReactNode };

const H3 = "mb-2 text-[15px] font-semibold text-white";
const LIST = "list-disc space-y-1 pl-5 text-neutral-300";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white">{`${n}. ${title}`}</h2>
      {children}
    </section>
  );
}

/** The privacy policy. Its words are in the "legal.privacy" messages; the Swedish text is the one that applies. */
export default async function PrivacyPage({ params }: LocaleParams) {
  const locale = await pageLocale(params);
  const t = await getTranslations("legal");
  // a text of the policy with its tags (links, bold) made into elements; the key is checked by the Swedish file instead
  const p = (key: string) => (t as unknown as RichTranslator).rich(`privacy.${key}`, legalRich);

  return (
    <>
      <SiteHeader />
      <main id="main" className="min-h-screen bg-[#111927]">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-white sm:text-[36px]">{t("privacy.title")}</h1>

          <p className="mt-6 text-[15px] leading-relaxed text-neutral-400">{t("privacy.updated")}</p>
          {locale !== "sv" && (
            <p className="mt-4 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] leading-relaxed text-neutral-300">
              {t("translationNotice")}
            </p>
          )}

          <div className="mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-neutral-200">
            <Section n={1} title={t("privacy.controller.title")}>
              <p>{p("controller.text")}</p>
            </Section>

            <Section n={2} title={t("privacy.data.title")}>
              <h3 className={H3}>{t("privacy.data.necessary.title")}</h3>
              <p>{t("privacy.data.necessary.intro")}</p>
              <ul className={`mt-2 ${LIST}`}>
                <li>{t("privacy.data.necessary.session")}</li>
                <li>{t("privacy.data.necessary.account")}</li>
                <li>{t("privacy.data.necessary.analyses")}</li>
                <li>{t("privacy.data.necessary.chat")}</li>
                <li>{p("data.necessary.language")}</li>
                <li>{p("data.necessary.translation")}</li>
              </ul>

              <h3 className={`${H3} mt-5`}>{t("privacy.data.stats.title")}</h3>
              <p>{t("privacy.data.stats.p1")}</p>
              <p className="mt-2">{t("privacy.data.stats.p2")}</p>

              <h3 className={`${H3} mt-5`}>{t("privacy.data.marketing.title")}</h3>
              <p>{p("data.marketing.p1")}</p>
              <p className="mt-2">{t("privacy.data.marketing.p2")}</p>
              <p className="mt-2">{t("privacy.data.marketing.p3")}</p>
              <p className="mt-2">{t("privacy.data.marketing.p4")}</p>
            </Section>

            <Section n={3} title={t("privacy.basis.title")}>
              <ul className={LIST}>
                <li>{p("basis.necessary")}</li>
                <li>{p("basis.stats")}</li>
                <li>{p("basis.marketing")}</li>
              </ul>
            </Section>

            <Section n={4} title={t("privacy.recipients.title")}>
              <p>{t("privacy.recipients.intro")}</p>
              <ul className={`mt-2 ${LIST}`}>
                <li>{p("recipients.supabase")}</li>
                <li>{p("recipients.stripe")}</li>
                <li>{p("recipients.openai")}</li>
                <li>{p("recipients.resend")}</li>
              </ul>
              <p className="mt-3 text-neutral-400">{t("privacy.recipients.safeguards")}</p>
            </Section>

            <Section n={5} title={t("privacy.retention.title")}>
              <ul className={LIST}>
                <li>{p("retention.accounts")}</li>
                <li>{p("retention.analyses")}</li>
                <li>{p("retention.stats")}</li>
                <li>{p("retention.cookie")}</li>
                <li>{p("retention.language")}</li>
                <li>{p("retention.translation")}</li>
                <li>{p("retention.other")}</li>
              </ul>
            </Section>

            <Section n={6} title={t("privacy.rights.title")}>
              <p>{t("privacy.rights.intro")}</p>
              <ul className={`mt-2 ${LIST}`}>
                <li>{t("privacy.rights.access")}</li>
                <li>{t("privacy.rights.rectification")}</li>
                <li>{t("privacy.rights.erasure")}</li>
                <li>{t("privacy.rights.objection")}</li>
                <li>{t("privacy.rights.portability")}</li>
                <li>{p("rights.complaint")}</li>
              </ul>
              <p className="mt-3">{p("rights.exercise")}</p>
            </Section>

            <Section n={7} title={t("privacy.consent.title")}>
              <p>{t("privacy.consent.p1")}</p>
              <p className="mt-3">{t("privacy.consent.p2")}</p>
              <ul className={`mt-2 ${LIST}`}>
                <li>{t("privacy.consent.viaBanner")}</li>
                <li>{p("consent.viaMail")}</li>
              </ul>
            </Section>

            <Section n={8} title={t("privacy.contact.title")}>
              <p>{t("privacy.contact.intro")}</p>
              <p className="mt-2">{p("contact.address")}</p>
            </Section>
          </div>
        </div>
      </main>
    </>
  );
}
