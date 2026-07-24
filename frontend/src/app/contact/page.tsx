"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MailIcon } from "@/components/icons";

export default function ContactPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

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
        setError(
          data.error?.message ??
            "Kontakt via formulär är inte tillgänglig just nu — mejla oss direkt på kopanalys@gmail.com istället.",
        );
        return;
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setMessage("");
      redirectTimer.current = setTimeout(() => router.push("/"), 2000);
    } catch {
      setError(
        "Kontakt via formulär är inte tillgänglig just nu — mejla oss direkt på kopanalys@gmail.com istället.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#111927]">
      <div className="mx-auto max-w-lg px-6 py-16 sm:py-24">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-white sm:text-[36px]">
          Kontakt
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-300">
          Har du en fråga, ett förslag eller något annat på hjärtat? Skicka ett meddelande så
          återkommer vi.
        </p>

        <div className="mt-10 rounded-[24px] border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl sm:p-7">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600/20">
                <MailIcon className="h-7 w-7 text-green-400" />
              </div>
              <p className="text-lg font-semibold text-white">Meddelande skickat!</p>
              <p className="text-sm text-neutral-400">
                Tack för ditt meddelande. Vi återkommer så snart vi kan.
              </p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="mt-2 text-sm font-medium text-green-400 underline underline-offset-4 transition hover:text-green-300"
              >
                Skicka ett till meddelande
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="contact-name" className="text-sm font-medium text-neutral-200">
                  Namn
                </label>
                <div className="relative mt-2">
                  <input
                    id="contact-name"
                    type="text"
                    placeholder="Ditt namn"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-4 pr-4 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-email" className="text-sm font-medium text-neutral-200">
                  E-post
                </label>
                <div className="relative mt-2">
                  <input
                    id="contact-email"
                    type="email"
                    placeholder="namn@exempel.se"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-4 pr-4 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-message" className="text-sm font-medium text-neutral-200">
                  Meddelande
                </label>
                <div className="relative mt-2">
                  <textarea
                    id="contact-message"
                    placeholder="Ditt meddelande..."
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    className="w-full resize-y rounded-xl border border-white/10 bg-black/40 py-3 pl-4 pr-4 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-sm text-red-400">
                  {error.includes("mejla oss") ? (
                    <>
                      {error.split("istället")[0]}
                      istället
                      <a
                        href="mailto:kopanalys@gmail.com"
                        className="ml-1 font-medium text-green-400 underline underline-offset-4 hover:text-green-300"
                      >
                        kopanalys@gmail.com
                      </a>
                    </>
                  ) : (
                    error
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-green-600 py-3.5 text-base font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MailIcon className="h-5 w-5" />
                {loading ? "Skickar..." : "Skicka meddelande"}
              </button>

              <p className="text-center text-xs text-neutral-500">
                Eller mejla oss direkt på{" "}
                <a
                  href="mailto:kopanalys@gmail.com"
                  className="font-medium text-green-400 underline underline-offset-4 transition hover:text-green-300"
                >
                  kopanalys@gmail.com
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
