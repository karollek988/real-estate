"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CloseIcon } from "./icons";

/**
 * The cookies the site can set, in the order they are shown. The words (title, description) are in
 * i18n/messages/<language>/consent.ts under dialog.items.<key>; `stored` is the technical name, which is the
 * same in every language.
 *
 * To add a cookie: add a row here, the texts for it in every language, and (for an optional one) a place in
 * lib/consent.ts to keep the choice - it only knows the one optional choice, `marketing`, today.
 */
const NECESSARY = [
  { key: "session", stored: "sb-…-auth-token" },
  { key: "language", stored: "NEXT_LOCALE" },
  { key: "choice", stored: "kopanalys_cookie_consent" },
] as const;
const OPTIONAL = [{ key: "marketing", stored: "ka_src" }] as const;

type OptionalKey = (typeof OPTIONAL)[number]["key"];

interface Props {
  /** the visitor saved their choice; `marketing` is whether the optional analytics cookie may be set */
  onSave: (choice: { marketing: boolean }) => void;
  /** closed without choosing anything (Escape, the cross, "Tillbaka"); the banner is still waiting for an answer */
  onBack: () => void;
}

/** The switch. A compulsory cookie gets one that is on and cannot be changed (still focusable, so it is read out). */
function Switch({
  checked,
  locked = false,
  onToggle,
  labelledBy,
  describedBy,
}: {
  checked: boolean;
  locked?: boolean;
  onToggle?: () => void;
  labelledBy: string;
  describedBy: string;
}) {
  const colour = locked ? "cursor-not-allowed bg-ka-muted/40" : checked ? "cursor-pointer bg-ka-green-900" : "cursor-pointer bg-ka-line-strong";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={locked || undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={locked ? undefined : onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${colour}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 rounded-full shadow transition-transform bg-white ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
      />
    </button>
  );
}

export function CookieSettingsDialog({ onSave, onBack }: Props) {
  const t = useTranslations("consent");
  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Nothing optional is on until the visitor switches it on.
  const [on, setOn] = useState<Record<OptionalKey, boolean>>({ marketing: false });

  // Escape goes back; Tab stays inside the dialog; the page behind does not scroll.
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onBack();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>("button, a[href]");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onBack]);

  const titleId = `${id}-title`;

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="fixed inset-0 animate-overlay-fade-in bg-ka-ink/70 backdrop-blur-sm" aria-hidden="true" />
      <div
        className="relative flex min-h-full items-center justify-center p-4 lg:p-8"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onBack();
        }}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="animate-modal-pop-in relative w-full max-w-[560px] overflow-hidden rounded-[24px] border border-ka-line-strong bg-white shadow-ka-card-hover focus:outline-none"
        >
          <button
            type="button"
            onClick={onBack}
            aria-label={t("dialog.close")}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ka-muted transition hover:bg-ka-sand hover:text-ka-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>

          <div className="px-6 pb-6 pt-8 lg:px-8">
            <h2 id={titleId} className="pr-8 text-xl font-semibold tracking-tight text-ka-ink">
              {t("dialog.title")}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ka-muted">
              {t.rich("dialog.intro", {
                link: (chunks) => (
                  <Link
                    href="/privacy"
                    className="font-medium text-ka-green-700 underline underline-offset-4 transition hover:text-ka-green-800"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>

            <div className="mt-5 max-h-[52vh] overflow-y-auto pr-1">
              <Group heading={t("dialog.necessary.title")} lead={t("dialog.necessary.lead")}>
                {NECESSARY.map(({ key, stored }) => (
                  <Row
                    key={key}
                    id={`${id}-${key}`}
                    title={t(`dialog.items.${key}.title`)}
                    description={t(`dialog.items.${key}.description`)}
                    stored={stored}
                    status={t("dialog.alwaysOn")}
                    checked
                    locked
                  />
                ))}
              </Group>
              <Group heading={t("dialog.optional.title")} lead={t("dialog.optional.lead")}>
                {OPTIONAL.map(({ key, stored }) => (
                  <Row
                    key={key}
                    id={`${id}-${key}`}
                    title={t(`dialog.items.${key}.title`)}
                    description={t(`dialog.items.${key}.description`)}
                    stored={stored}
                    status={on[key] ? t("dialog.on") : t("dialog.off")}
                    checked={on[key]}
                    onToggle={() => setOn((current) => ({ ...current, [key]: !current[key] }))}
                  />
                ))}
              </Group>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onBack}
                className="cursor-pointer rounded-xl border border-ka-line-strong bg-ka-cream px-5 py-2.5 text-sm font-semibold text-ka-text transition hover:border-ka-green-700/40 hover:bg-ka-sand"
              >
                {t("dialog.back")}
              </button>
              <button
                type="button"
                onClick={() => onSave({ marketing: on.marketing })}
                className="cursor-pointer rounded-xl bg-ka-green-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ka-green-800"
              >
                {t("dialog.save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ heading, lead, children }: { heading: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ka-text">{heading}</h3>
      <p className="mt-0.5 text-xs text-ka-muted">{lead}</p>
      <ul className="mt-2 flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function Row({
  id,
  title,
  description,
  stored,
  status,
  checked,
  locked,
  onToggle,
}: {
  id: string;
  title: string;
  description: string;
  stored: string;
  status: string;
  checked: boolean;
  locked?: boolean;
  onToggle?: () => void;
}) {
  return (
    <li className={`rounded-xl border border-ka-line-strong p-4 ${locked ? "bg-white" : "bg-ka-cream"}`}>
      <div className="flex items-center justify-between gap-4">
        <h4 id={`${id}-title`} className="text-sm font-semibold text-ka-ink">
          {title}
        </h4>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className={`text-xs ${locked ? "text-ka-muted" : checked ? "text-ka-green-700" : "text-ka-muted"}`}>{status}</span>
          <Switch checked={checked} locked={locked} onToggle={onToggle} labelledBy={`${id}-title`} describedBy={`${id}-description`} />
        </div>
      </div>
      <p id={`${id}-description`} className="mt-1.5 text-xs leading-relaxed text-ka-muted">
        {description}
      </p>
      <p className="mt-1.5 text-[11px] text-ka-muted">
        <code className="rounded bg-ka-cream px-1.5 py-0.5 font-mono text-ka-muted">{stored}</code>
      </p>
    </li>
  );
}
