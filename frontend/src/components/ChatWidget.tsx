"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { QuestionIcon, CloseIcon, ArrowRightIcon, MailIcon } from "@/components/icons";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CONTACT_EMAIL = "kontakt@kopanalys.se";

export function ChatWidget() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: t("greeting") }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setUnavailable(false);

    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // the page's language: the assistant answers in it
        body: JSON.stringify({ messages: updatedMessages, locale }),
      });

      const data = await res.json();

      if (res.status === 503 || data?.error?.code === "chat_unavailable") {
        setUnavailable(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: t("unavailable", { email: CONTACT_EMAIL }),
          },
        ]);
      } else if (data?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setUnavailable(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("unavailable", { email: CONTACT_EMAIL }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-3 z-[90] flex w-[360px] max-w-[calc(100vw-24px)] flex-col rounded-2xl border border-ka-line-strong bg-white shadow-ka-card-hover">
          <div className="flex items-center justify-between border-b border-ka-line-strong px-4 py-3">
            <span className="text-sm font-semibold text-ka-ink">{t("title")}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-ka-muted transition hover:text-ka-ink"
              aria-label={t("close")}
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div ref={listRef} className="flex h-[400px] flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-ka-green-900 text-white"
                      : "bg-ka-sand text-ka-text"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-ka-sand px-3.5 py-2 text-sm text-ka-muted">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ka-muted" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ka-muted [animation-delay:0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ka-muted [animation-delay:0.2s]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-ka-line-strong px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("placeholder")}
                disabled={loading}
                className="min-w-0 flex-1 rounded-xl border border-ka-line-strong bg-ka-cream px-3.5 py-2 text-sm text-ka-ink placeholder:text-ka-muted/70 outline-none transition focus:border-ka-green-700/40 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ka-green-900 text-white transition hover:bg-ka-green-800 disabled:opacity-50"
                aria-label={t("send")}
              >
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-3 right-3 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-ka-green-900 text-white shadow-ka-card-hover transition hover:bg-ka-green-800"
        aria-label={open ? t("close") : t("open")}
      >
        {open ? (
          <CloseIcon className="h-5 w-5" />
        ) : (
          <QuestionIcon className="h-5 w-5" />
        )}
      </button>
    </>
  );
}
