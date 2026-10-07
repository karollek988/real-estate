"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Reveal } from "@/components/Reveal";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { MailIcon } from "@/components/icons";

const CONTACT_EMAIL = "kontakt@kopanalys.se";

/** What went wrong with sending: the form is not available (the visitor is pointed to e-mail), or the server said why. */
type SendError = { kind: "unavailable" } | { kind: "message"; text: string };

/** The contact form (POST /api/contact). The landing page's last section and the body of /kontakt. */
export function ContactSection({
  titleAs: Title = "h2",
  title,
}: {
  /** "h1" when the section opens its page (/kontakt). */
  titleAs?: "h1" | "h2";
  /** Replaces the heading (the "sections" messages have a default). */
  title?: string;
} = {}) {
  const t = useTranslations("sections.contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<SendError | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const mailLink = (chunks: React.ReactNode, className: string) => (
    <a href={`mailto:${CONTACT_EMAIL}`} className={className}>
      {chunks}
    </a>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        // "contact_unavailable": the server could not send the e-mail; anything else it explains itself
        const text = data.error?.code === "contact_unavailable" ? undefined : data.error?.message;
        setError(text ? { kind: "message", text } : { kind: "unavailable" });
        return;
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setMessage("");
      successTimer.current = setTimeout(() => setSuccess(false), 6000);
    } catch {
      setError({ kind: "unavailable" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="kontakt" aria-labelledby="kontakt-title" className="scroll-mt-24 bg-ka-cream">
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <Reveal variant="left">
            <div className="lg:sticky lg:top-28">
              <p className="inline-flex items-center gap-2 rounded-full bg-ka-sage/70 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
                <MailIcon className="h-4 w-4" />
                {t("eyebrow")}
              </p>
              <Title
                id="kontakt-title"
                className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] text-ka-ink sm:text-[44px]"
              >
                {title ?? t("title")}
              </Title>
              <p className="mt-4 max-w-[420px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
                {t.rich("text", {
                  email: CONTACT_EMAIL,
                  mail: (chunks) => mailLink(chunks, "font-semibold text-ka-green-700 underline underline-offset-4 hover:text-ka-green-900"),
                })}
              </p>
            </div>
          </Reveal>

          <Reveal variant="up">
            <div className="rounded-[22px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)] sm:p-8">
              {success ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ka-sage/70">
                    <MailIcon className="h-7 w-7 text-ka-green-800" />
                  </div>
                  <p className="text-lg font-bold text-ka-ink">{t("success.title")}</p>
                  <p className="text-sm text-ka-muted">{t("success.text")}</p>
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="mt-2 text-sm font-semibold text-ka-green-700 underline underline-offset-4 transition hover:text-ka-green-900"
                  >
                    {t("success.again")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact-name" className="text-sm font-semibold text-ka-ink">
                        {t("fields.name")}
                      </label>
                      <div className="relative mt-2">
                        <input
                          id="contact-name"
                          type="text"
                          placeholder={t("fields.namePlaceholder")}
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="w-full rounded-xl border border-ka-line bg-white py-3 pl-4 pr-4 text-[15px] text-ka-ink placeholder:text-ka-muted/60 outline-none transition focus:border-ka-green-700 focus:ring-4 focus:ring-ka-green-700/10"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contact-email" className="text-sm font-semibold text-ka-ink">
                        {t("fields.email")}
                      </label>
                      <div className="relative mt-2">
                        <input
                          id="contact-email"
                          type="email"
                          placeholder={t("fields.emailPlaceholder")}
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full rounded-xl border border-ka-line bg-white py-3 pl-4 pr-4 text-[15px] text-ka-ink placeholder:text-ka-muted/60 outline-none transition focus:border-ka-green-700 focus:ring-4 focus:ring-ka-green-700/10"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="text-sm font-semibold text-ka-ink">
                      {t("fields.message")}
                    </label>
                    <div className="relative mt-2">
                      <textarea
                        id="contact-message"
                        placeholder={t("fields.messagePlaceholder")}
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        className="w-full resize-y rounded-xl border border-ka-line bg-white py-3 pl-4 pr-4 text-[15px] text-ka-ink placeholder:text-ka-muted/60 outline-none transition focus:border-ka-green-700 focus:ring-4 focus:ring-ka-green-700/10"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-xl border border-ka-red-600/25 bg-ka-red-600/[0.06] px-4 py-2.5 text-sm text-ka-red-600">
                      {error.kind === "unavailable"
                        ? t.rich("unavailable", {
                            email: CONTACT_EMAIL,
                            mail: (chunks) => mailLink(chunks, "font-semibold text-ka-green-700 underline underline-offset-4 hover:text-ka-green-900"),
                          })
                        : error.text}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-[12px] bg-ka-green-900 py-3.5 text-[15px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-ka-green-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto sm:px-10"
                  >
                    <MailIcon className="h-5 w-5" />
                    {loading ? t("sending") : t("submit")}
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
