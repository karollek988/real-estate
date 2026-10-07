import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { AdminStatsResult } from "@/lib/admin/stats";
import type { MeasuredResult } from "@/lib/markov/measured";
import { MarkovSimulator } from "./markov/MarkovSimulator";
import { StatsPanel } from "./stats/StatsPanel";

const TABS = [
  { id: "stats", label: "Statistik" },
  { id: "markov", label: "Markov-simulator" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// The open tab lives in the address (#markov), so a reload or a shared link lands on it. React reads
// it as an external store: the server's HTML (and the browser's first pass over it) say "no
// address", so both start on the statistics, and the browser then moves to the tab in the address.
const subscribeToAddress = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const readAddress = () => window.location.hash;
const readAddressOnServer = () => "";

/** What a signed-in admin sees: a slim session bar, the tabs, and the open tab's page. */
export function AdminShell({ stats, measured }: { stats: AdminStatsResult; measured: MeasuredResult }) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const address = useSyncExternalStore(subscribeToAddress, readAddress, readAddressOnServer);
  const tab: TabId = TABS.find((t) => `#${t.id}` === address)?.id ?? "stats";
  const tabButtons = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  function openTab(id: TabId, focus = false) {
    window.history.replaceState(null, "", id === "stats" ? window.location.pathname + window.location.search : `#${id}`);
    // replaceState says nothing to listeners; this is what makes the store re-read the address
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    if (focus) tabButtons.current[id]?.focus();
  }

  // Arrow keys, Home and End move between the tabs, as a tab list is expected to.
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = TABS.findIndex((t) => t.id === tab);
    const target =
      event.key === "ArrowRight" ? (current + 1) % TABS.length : event.key === "ArrowLeft" ? (current - 1 + TABS.length) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
    if (target < 0) return;
    event.preventDefault();
    openTab(TABS[target].id, true);
  }

  async function signOut() {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      const response = await fetch("/api/admin-portal/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`logout failed: ${response.status}`);
      window.location.replace("/");
    } catch {
      setSigningOut(false);
      setSignOutFailed(true);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-strip">
        <span className="admin-strip-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Köpanalys Admin
        </span>
        <span className="admin-strip-spacer" />
        {signOutFailed && (
          <span role="alert" className="admin-strip-error">
            Utloggningen misslyckades
          </span>
        )}
        <span className="admin-strip-user">Inloggad som admin</span>
        <button type="button" onClick={signOut} disabled={signingOut}>
          {signingOut ? "Loggar ut…" : "Logga ut"}
        </button>
      </header>

      <div className="admin-tabs" role="tablist" aria-label="Administration">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabButtons.current[t.id] = el;
            }}
            id={`admin-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`admin-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => openTab(t.id)}
            onKeyDown={onTabKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="admin-content">
        <div className="admin-page">
          {/* both pages stay in the document, so the chosen period (and the simulator's edits) survive a trip to the other tab */}
          <div role="tabpanel" id="admin-panel-stats" aria-labelledby="admin-tab-stats" hidden={tab !== "stats"}>
            <StatsPanel result={stats} />
          </div>
          <div role="tabpanel" id="admin-panel-markov" aria-labelledby="admin-tab-markov" hidden={tab !== "markov"}>
            <MarkovSimulator measured={measured} stats={stats} />
          </div>
        </div>
      </main>
    </div>
  );
}
