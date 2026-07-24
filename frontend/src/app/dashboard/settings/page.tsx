"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { SettingsIcon, MailIcon, WarningIcon, CheckIcon, LockIcon, CrownIcon, CreditCardIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

function ProfileEditCard({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const currentName = (user?.user_metadata?.full_name as string | undefined) || "";
  const currentEmail = user?.email ?? "";

  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Re-sync local fields if the auth context refreshes with new values
  // (e.g. after a successful save triggers a session refresh).
  useEffect(() => {
    setName(currentName);
    setEmail(currentEmail);
  }, [currentName, currentEmail]);

  const dirty = name.trim() !== currentName || email.trim().toLowerCase() !== currentEmail.toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nameValid = name.trim().length > 0;
  const emailValid = EMAIL_RE.test(email.trim());

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!nameValid) {
      setError("Namnet får inte vara tomt.");
      return;
    }
    if (!emailValid) {
      setError("Ange en giltig e-postadress.");
      return;
    }
    if (!password) {
      setError("Ange ditt nuvarande lösenord för att spara ändringarna.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          currentPassword: password,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Något gick fel. Försök igen.");
        setSaving(false);
        return;
      }
      // Pull the session up to date so the header/profile card reflect the
      // new name/email without requiring a full re-login.
      await createClient().auth.refreshSession();
      setPassword("");
      setSuccess(true);
    } catch {
      setError("Något gick fel. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dash-enter rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl" style={stagger(1)}>
      <h2 className="text-sm font-semibold text-white">Kontouppgifter</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Ändra ditt namn eller din e-postadress. Du behöver bekräfta med ditt lösenord.
      </p>

      <form onSubmit={handleSave} className="mt-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-neutral-300">
            Namn
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSuccess(false);
              }}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
              placeholder="Ditt namn"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-neutral-300">
            E-post
            <div className="relative">
              <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSuccess(false);
                }}
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
                placeholder="din@epost.se"
              />
            </div>
          </label>
        </div>

        {dirty && (
          <label className="flex flex-col gap-2 text-sm text-neutral-300">
            Nuvarande lösenord
            <div className="relative">
              <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSuccess(false);
                }}
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <span className="text-xs text-neutral-500">
              Krävs för att ändra namn eller e-post.
            </span>
          </label>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && (
          <p className="flex items-center gap-1.5 text-sm text-green-400">
            <CheckIcon className="h-4 w-4" />
            Dina uppgifter har uppdaterats.
          </p>
        )}

        <div>
          <Button type="submit" disabled={!dirty || saving} className="disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Sparar..." : "Spara ändringar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    status: string | null;
    tier: string | null;
    currentPeriodEnd: string | null;
  } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/summary");
      if (res.ok) {
        const data = await res.json();
        setSubscription({
          status: data.subscriptionStatus,
          tier: data.subscriptionTier,
          currentPeriodEnd: data.currentPeriodEnd,
        });
      }
    } catch {
      // Silently fail — subscription info is not critical for settings page load
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  async function handleManageSubscription() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPortalError(data?.error?.message ?? "Kunde inte öppna betalningsportalen.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setPortalError("Något gick fel. Försök igen.");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleDelete() {
    if (confirmEmail.trim().toLowerCase() !== (user?.email ?? "").toLowerCase()) {
      setError("E-postadressen stämmer inte överens med ditt konto.");
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Något gick fel. Försök igen.");
        setDeleting(false);
        return;
      }
      await signOut();
      router.push("/");
    } catch {
      setError("Något gick fel. Försök igen.");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="dash-enter" style={stagger(0)}>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-white">
          <SettingsIcon className="h-6 w-6 text-neutral-300" />
          Inställningar
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Hantera ditt konto och dina uppgifter.
        </p>
      </div>

      <ProfileEditCard user={user} />

      <div className="dash-enter rounded-2xl border border-green-500/20 bg-green-500/[0.04] p-5 backdrop-blur-xl" style={stagger(2)}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
            <CrownIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-green-300">Abonnemang</h2>
        </div>

        {subscription === null ? (
          <p className="mt-3 text-sm text-neutral-400">Laddar...</p>
        ) : subscription.tier ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-neutral-300">
              <span className="font-medium text-white">
                {subscription.tier === "premium" ? "Premium" : "Ultra"}
              </span>
              <span className="ml-2 text-xs uppercase tracking-wide text-green-400">
                {subscription.status === "active" ? "Aktivt" : subscription.status === "past_due" ? "Förfallen" : "Avslutat"}
              </span>
            </p>
            {subscription.currentPeriodEnd && (
              <p className="text-sm text-neutral-400">
                Nästa betalning: {new Date(subscription.currentPeriodEnd).toLocaleDateString("sv-SE")}
              </p>
            )}
            {portalError && <p className="text-sm text-red-400">{portalError}</p>}
            <div className="mt-2">
              <Button
                variant="secondary"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="flex items-center gap-2"
              >
                <CreditCardIcon className="h-4 w-4" />
                {portalLoading ? "Öppnar portal..." : "Hantera abonnemang"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-neutral-400">
              Du har inget aktivt abonnemang.
            </p>
            <div className="mt-3">
              <Button onClick={() => router.push("/dashboard/buy")}>
                Se abonnemang
              </Button>
            </div>
          </div>
        )}
      </div>

      <div
        className="dash-enter rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5 backdrop-blur-xl"
        style={stagger(4)}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
            <WarningIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-red-300">Radera konto</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Detta tar permanent bort ditt konto, dina beslutsanalyser och sparade bostäder.
          Delade BRF-årsredovisningar och delad marknadsdata påverkas inte.
        </p>

        {!confirming ? (
          <Button
            variant="secondary"
            className="mt-4 border-red-500/30 text-red-300 hover:bg-red-500/10"
            onClick={() => setConfirming(true)}
          >
            Radera konto
          </Button>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-sm text-neutral-300">
              Skriv din e-postadress ({user?.email}) för att bekräfta:
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-red-500/60 focus:ring-4 focus:ring-red-500/10"
                placeholder={user?.email ?? ""}
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Raderar..." : "Radera konto permanent"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirming(false);
                  setConfirmEmail("");
                  setError(null);
                }}
                disabled={deleting}
              >
                Avbryt
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
