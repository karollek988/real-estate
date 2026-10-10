"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  CheckIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  HouseIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
} from "./icons";

type AuthMode = "login" | "register";

function GoogleButton() {
  const t = useTranslations("auth");
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={async () => {
          setError(null);
          const { error } = await signInWithGoogle();
          if (error) setError(error.message);
        }}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-ka-line-strong bg-ka-cream py-3 text-sm font-semibold text-ka-text transition hover:border-ka-green-700/40 hover:bg-ka-sand"
      >
        <GoogleIcon className="h-[18px] w-[18px]" />
        {t("google")}
      </button>
      {error && <p className="text-xs text-ka-red-600">{error}</p>}
    </div>
  );
}

function OrDivider() {
  const t = useTranslations("auth");
  return (
    <div className="my-5 flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-ka-sand" />
      <span className="text-xs font-medium text-ka-muted">{t("or")}</span>
      <span className="h-px flex-1 bg-ka-sand" />
    </div>
  );
}

function TextField({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
  icon: Icon,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  autoComplete?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ka-text">
        {label}
      </label>
      <div className="relative mt-2">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ka-muted" />
        )}
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`w-full rounded-xl border border-ka-line-strong bg-white py-3 ${
            Icon ? "pl-11" : "pl-4"
          } pr-4 text-sm text-ka-ink placeholder:text-ka-muted outline-none transition focus:border-ka-green-700 focus:ring-4 focus:ring-ka-green-700/15`}
        />
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const t = useTranslations("auth.fields");
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ka-text">
        {label}
      </label>
      <div className="relative mt-2">
        <LockIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ka-muted" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          placeholder="••••••••"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={6}
          className="w-full rounded-xl border border-ka-line-strong bg-white py-3 pl-11 pr-12 text-sm text-ka-ink placeholder:text-ka-muted outline-none transition focus:border-ka-green-700 focus:ring-4 focus:ring-ka-green-700/15"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ka-muted transition hover:text-ka-text"
        >
          {visible ? (
            <EyeOffIcon className="h-[18px] w-[18px]" />
          ) : (
            <EyeIcon className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
}

function Checkbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer select-none items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-4 peer-focus-visible:ring-ka-green-700/20 ${
          checked ? "border-ka-green-900 bg-ka-green-900" : "border-ka-line-strong bg-white"
        }`}
      >
        {checked && <CheckIcon className="h-3.5 w-3.5 text-white" />}
      </span>
      <span className="text-sm leading-snug text-ka-text">{children}</span>
    </label>
  );
}

function SubmitButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-ka-green-900 py-3.5 text-base font-semibold text-white transition hover:bg-ka-green-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-4 rounded-xl border border-ka-coral-300 bg-ka-coral-100 px-4 py-2.5 text-sm text-ka-red-600">
      {message}
    </p>
  );
}

function isEmailNotConfirmedError(error: { code?: string; message: string }): boolean {
  return error.code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed");
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations("auth.login");
  const tFields = useTranslations("auth.fields");
  const { signIn, resendSignupConfirmation } = useAuth();
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsConfirmation(false);
    setResendState("idle");
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error.message);
      setNeedsConfirmation(isEmailNotConfirmedError(error));
      return;
    }
    onSuccess();
  }

  async function handleResend() {
    setResendState("sending");
    const { error } = await resendSignupConfirmation(email);
    setResendState(error ? "idle" : "sent");
    if (error) setError(error.message);
  }

  return (
    <form onSubmit={handleSubmit}>
      <GoogleButton />
      <OrDivider />
      <div className="flex flex-col gap-4">
        <TextField
          id="auth-email"
          label={tFields("email")}
          type="email"
          placeholder={tFields("emailPlaceholder")}
          autoComplete="email"
          icon={MailIcon}
          value={email}
          onChange={setEmail}
          required
        />
        <PasswordField
          id="auth-password"
          label={tFields("password")}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Checkbox id="auth-remember" checked={remember} onChange={setRemember}>
          {t("remember")}
        </Checkbox>
        <button
          type="button"
          className="text-sm font-medium text-ka-green-700 underline underline-offset-4 transition hover:text-ka-green-800"
        >
          {t("forgotPassword")}
        </button>
      </div>
      <ErrorMessage message={error} />
      {needsConfirmation && (
        <div className="mt-3">
          {resendState === "sent" ? (
            <p className="flex items-center gap-1.5 text-sm text-ka-green-700">
              <CheckIcon className="h-4 w-4" />
              {t("resent")}
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendState === "sending"}
              className="cursor-pointer text-sm font-medium text-ka-green-700 underline underline-offset-4 transition hover:text-ka-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendState === "sending" ? t("resending") : t("resend")}
            </button>
          )}
        </div>
      )}
      <SubmitButton disabled={loading}>
        <LockIcon className="h-5 w-5" />
        {loading ? t("submitting") : t("submit")}
      </SubmitButton>
    </form>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations("auth.register");
  const tFields = useTranslations("auth.fields");
  const locale = useLocale();
  const { signUp } = useAuth();
  const [agree, setAgree] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agree) {
      setError(t("errors.mustAgree"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }

    setLoading(true);
    const { data, error } = await signUp(email, password, `${firstName} ${lastName}`.trim(), firstName.trim(), locale);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    // Confirmation is required: signUp returns a user but no session until
    // the emailed link is clicked and verified via /auth/confirm. Redirecting
    // to /dashboard now would just bounce off the auth-gated middleware.
    if (data.user && !data.session) {
      setPendingConfirmationEmail(email);
      return;
    }

    onSuccess();
  }

  if (pendingConfirmationEmail) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ka-sage">
          <MailIcon className="h-7 w-7 text-ka-green-700" />
        </div>
        <p className="text-lg font-semibold text-ka-ink">{t("checkInbox.title")}</p>
        <p className="text-sm text-ka-muted">
          {t.rich("checkInbox.text", {
            email: pendingConfirmationEmail,
            b: (chunks) => <span className="font-medium text-ka-text">{chunks}</span>,
          })}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="auth-first-name"
            label={tFields("firstName")}
            placeholder={tFields("firstNamePlaceholder")}
            autoComplete="given-name"
            value={firstName}
            onChange={setFirstName}
            required
          />
          <TextField
            id="auth-last-name"
            label={tFields("lastName")}
            placeholder={tFields("lastNamePlaceholder")}
            autoComplete="family-name"
            value={lastName}
            onChange={setLastName}
            required
          />
        </div>
        <TextField
          id="auth-register-email"
          label={tFields("email")}
          type="email"
          placeholder={tFields("emailPlaceholder")}
          autoComplete="email"
          icon={MailIcon}
          value={email}
          onChange={setEmail}
          required
        />
        <PasswordField
          id="auth-new-password"
          label={tFields("password")}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          required
        />
        <PasswordField
          id="auth-confirm-password"
          label={tFields("confirmPassword")}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
        />
      </div>
      <div className="mt-4">
        <Checkbox id="auth-terms" checked={agree} onChange={setAgree}>
          {t.rich("agree", {
            terms: (chunks) => (
              <Link
                href="/terms"
                className="font-medium text-ka-green-700 underline underline-offset-4 transition hover:text-ka-green-800"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/privacy"
                className="font-medium text-ka-green-700 underline underline-offset-4 transition hover:text-ka-green-800"
              >
                {chunks}
              </Link>
            ),
          })}
        </Checkbox>
      </div>
      <ErrorMessage message={error} />
      <SubmitButton disabled={loading}>{loading ? t("submitting") : t("submit")}</SubmitButton>
    </form>
  );
}

/**
 * The sign-in and registration dialog. After a sign-in it takes the visitor to the dashboard, unless `stayOnPage` is set:
 * a page that asked for the sign-in for its own sake (the map, to post a listing) wants the visitor to stay where they are.
 */
export function AuthModal({ open, onClose, stayOnPage = false }: { open: boolean; onClose: () => void; stayOnPage?: boolean }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<AuthMode>("login");
  const router = useRouter();

  function handleAuthSuccess() {
    onClose();
    if (!stayOnPage) router.push("/dashboard");
  }

  useEffect(() => {
    if (!open) return;
    setMode("login");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const login = mode === "login";

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={login ? t("login.dialogLabel") : t("register.dialogLabel")}
    >
      <div
        className="fixed inset-0 animate-overlay-fade-in bg-ka-ink/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        className="relative flex min-h-full items-stretch justify-center lg:items-center lg:p-8"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="animate-modal-pop-in relative w-full overflow-hidden bg-ka-paper lg:w-[440px] lg:rounded-[20px] lg:border lg:border-ka-line-strong lg:bg-white lg:shadow-ka-card-hover">
          {/* Mobile: hero backdrop behind the whole screen */}
          <div className="absolute inset-0 lg:hidden" aria-hidden="true">
            <Image
              src="/hero-background.png"
              alt=""
              fill
              className="object-cover object-top"
            />
            <div className="absolute inset-0 bg-ka-cream/80" />
            <div className="absolute inset-0 bg-gradient-to-b from-ka-cream/40 via-ka-cream/70 to-ka-cream" />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute right-4 top-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ka-muted transition hover:bg-ka-cream hover:text-ka-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>

          <div className="relative px-5 pb-10 pt-7 lg:px-7 lg:pb-7 lg:pt-7">
            {/* Mobile brand */}
            <div className="flex items-center justify-center gap-2.5 lg:hidden">
              <HouseIcon className="h-7 w-7 text-ka-green-700" />
              <span className="text-xl font-semibold tracking-tight text-ka-ink">
                Köpanalys
              </span>
            </div>

            <div key={mode} className="animate-fade-in-up">
              {/* Mobile headline */}
              <div className="mt-10 text-center lg:hidden">
                <h2 className="text-[28px] font-bold leading-[1.3] tracking-tight text-ka-ink">
                  {t(login ? "login.mobileLine1" : "register.mobileLine1")}
                  <br />
                  {t.rich(login ? "login.mobileLine2" : "register.mobileLine2", {
                    accent: (chunks) => <span className="text-ka-green-700">{chunks}</span>,
                  })}
                </h2>
                <p className="mx-auto mt-4 max-w-[300px] text-[15px] leading-relaxed text-ka-text">
                  {t(login ? "login.mobileLead" : "register.mobileLead")}
                </p>
              </div>

              {/* Desktop headline */}
              <div className="hidden lg:block lg:pr-10">
                <h2 className="text-2xl font-bold tracking-tight text-ka-ink">
                  {t(login ? "login.headline" : "register.headline")}
                </h2>
                <p className="mt-1.5 text-sm text-ka-muted">
                  {t(login ? "login.lead" : "register.lead")}
                </p>
              </div>

              <div className="mt-8 rounded-[24px] border border-ka-line-strong bg-white/90 p-5 backdrop-blur-xl lg:mt-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                {login ? (
                  <LoginForm onSuccess={handleAuthSuccess} />
                ) : (
                  <RegisterForm onSuccess={handleAuthSuccess} />
                )}
              </div>

              <p className="mt-7 text-center text-[15px] text-ka-text lg:mt-6 lg:text-sm lg:text-ka-muted">
                {t(login ? "login.switchPrompt" : "register.switchPrompt")}{" "}
                <button
                  type="button"
                  onClick={() => setMode(login ? "register" : "login")}
                  className="cursor-pointer font-semibold text-ka-green-700 transition hover:text-ka-green-800"
                >
                  {t(login ? "login.switchAction" : "register.switchAction")}
                </button>
              </p>
            </div>

            {/* Mobile trust footer */}
            <div className="mt-12 text-center lg:hidden">
              <p className="flex items-center justify-center gap-2 text-[15px] font-medium text-ka-ink">
                <ShieldIcon className="h-5 w-5 text-ka-green-700" />
                {t("trust.title")}
              </p>
              <p className="mt-2 text-sm text-ka-muted">
                {t("trust.text")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
