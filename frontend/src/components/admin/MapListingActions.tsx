"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Hide or show one pin of the public map (/admin/map). Hiding asks for a reason, which only the team sees. The console
 * is Swedish only, so its words are here, not in the message files.
 */
export function MapListingActions({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "hide" | "show") {
    let reason: string | null = null;
    if (action === "hide") {
      reason = window.prompt("Varför döljs annonsen? (Syns bara för teamet. Lämna tomt för ingen anledning.)", "");
      if (reason === null) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/map-listings/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Något gick fel.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => send(hidden ? "show" : "hide")}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
          hidden ? "bg-ka-green-900 text-white hover:bg-ka-green-800" : "border border-ka-line-strong bg-white text-ka-ink hover:bg-ka-sand"
        }`}
      >
        {busy ? "…" : hidden ? "Visa igen" : "Dölj"}
      </button>
      {error && <span className="text-xs text-ka-coral-700">{error}</span>}
    </div>
  );
}
