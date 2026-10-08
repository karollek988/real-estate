import Image from "next/image";
import { useId, useRef, useState, type FormEvent } from "react";

interface LoginResponse {
  error?: string;
  retryAfterSeconds?: number;
}

function messageFor(status: number, body: LoginResponse): string {
  switch (body.error) {
    case "invalid_credentials":
      return "Fel användarnamn eller lösenord.";
    case "too_many_attempts": {
      const minutes = Math.max(1, Math.ceil((body.retryAfterSeconds ?? 900) / 60));
      return `För många misslyckade försök. Försök igen om ${minutes} ${minutes === 1 ? "minut" : "minuter"}.`;
    }
    case "not_configured":
      return "Inloggningen är inte konfigurerad på servern.";
    case "busy":
      return "Servern är upptagen just nu. Försök igen om en stund.";
    default:
      return status >= 500 ? "Något gick fel på servern. Försök igen." : "Inloggningen misslyckades. Ladda om sidan och försök igen.";
  }
}

export function AdminLogin() {
  const usernameId = useId();
  const passwordId = useId();
  const errorId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin-portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.ok) {
        // Hard navigation: the server re-renders "/" and now sees the session cookie.
        window.location.replace("/");
        return;
      }
      const body: LoginResponse = await response.json().catch(() => ({}));
      setError(messageFor(response.status, body));
    } catch {
      setError("Kunde inte nå servern. Kontrollera anslutningen och försök igen.");
    }
    setPassword("");
    setSubmitting(false);
    passwordRef.current?.focus();
  }

  return (
    <main className="admin-login">
      {/* method="post" so that, if this ever submitted without JavaScript, the
          credentials could never end up in the URL. */}
      <form className="admin-login-card" method="post" action="/api/admin-portal/login" onSubmit={onSubmit} aria-describedby={error ? errorId : undefined}>
        <div className="admin-login-brand">
          <Image src="/images/kopanalys-logo-mark.png" alt="" width={32} height={32} priority />
          <span className="admin-login-wordmark">
            Köpanalys<span>.se</span>
          </span>
          <span className="admin-login-badge">Admin</span>
        </div>
        <h1>Logga in</h1>
        <p className="admin-login-lead">Endast för behöriga användare.</p>

        <label htmlFor={usernameId}>Användarnamn</label>
        <input
          id={usernameId}
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          maxLength={256}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />

        <label htmlFor={passwordId}>Lösenord</label>
        <div className="admin-login-password">
          <input
            ref={passwordRef}
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="button" className="admin-login-reveal" onClick={() => setShowPassword((shown) => !shown)} aria-pressed={showPassword}>
            {showPassword ? "Dölj" : "Visa"}
          </button>
        </div>

        {error && (
          <p id={errorId} role="alert" className="admin-login-error">
            {error}
          </p>
        )}

        <button type="submit" className="admin-login-submit" disabled={submitting || !username.trim() || !password}>
          {submitting ? "Loggar in…" : "Logga in"}
        </button>
      </form>
    </main>
  );
}
