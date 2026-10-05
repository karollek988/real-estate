import { useState } from "react";

/** What a signed-in admin sees: a slim session bar above an empty page. */
export function AdminShell() {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

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
      <main className="admin-content" />
    </div>
  );
}
