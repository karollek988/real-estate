"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-neutral-100 transition hover:border-white/20 hover:bg-white/10"
      >
        <GoogleIcon className="h-[18px] w-[18px]" />
        Fortsätt med Google
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-white/10" />
      <span className="text-xs font-medium text-neutral-500">eller</span>
      <span className="h-px flex-1 bg-white/10" />
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
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">
        {label}
      </label>
      <div className="relative mt-2">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        )}
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`w-full rounded-xl border border-white/10 bg-black/40 py-3 ${
            Icon ? "pl-11" : "pl-4"
          } pr-4 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10`}
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
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">
        {label}
      </label>
      <div className="relative mt-2">
        <LockIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          placeholder="••••••••"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={6}
          className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-12 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Dölj lösenord" : "Visa lösenord"}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition hover:text-neutral-300"
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
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-4 peer-focus-visible:ring-green-500/20 ${
          checked ? "border-green-500 bg-green-600" : "border-white/15 bg-black/40"
        }`}
      >
        {checked && <CheckIcon className="h-3.5 w-3.5 text-white" />}
      </span>
      <span className="text-sm leading-snug text-neutral-300">{children}</span>
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
      className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-green-600 py-3.5 text-base font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-sm text-red-400">
      {message}
    </p>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn } = useAuth();
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit}>
      <GoogleButton />
      <OrDivider />
      <div className="flex flex-col gap-4">
        <TextField
          id="auth-email"
          label="E-postadress"
          type="email"
          placeholder="namn@exempel.se"
          autoComplete="email"
          icon={MailIcon}
          value={email}
          onChange={setEmail}
          required
        />
        <PasswordField
          id="auth-password"
          label="Lösenord"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Checkbox id="auth-remember" checked={remember} onChange={setRemember}>
          Kom ihåg mig
        </Checkbox>
        <button
          type="button"
          className="text-sm font-medium text-green-400 underline underline-offset-4 transition hover:text-green-300"
        >
          Glömt lösenord?
        </button>
      </div>
      <ErrorMessage message={error} />
      <SubmitButton disabled={loading}>
        <LockIcon className="h-5 w-5" />
        {loading ? "Loggar in..." : "Logga in"}
      </SubmitButton>
    </form>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { signUp } = useAuth();
  const [agree, setAgree] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agree) {
      setError("Du måste godkänna villkoren för att skapa ett konto.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Lösenorden matchar inte.");
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, `${firstName} ${lastName}`.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="auth-first-name"
            label="Förnamn"
            placeholder="Anna"
            autoComplete="given-name"
            value={firstName}
            onChange={setFirstName}
            required
          />
          <TextField
            id="auth-last-name"
            label="Efternamn"
            placeholder="Svensson"
            autoComplete="family-name"
            value={lastName}
            onChange={setLastName}
            required
          />
        </div>
        <TextField
          id="auth-register-email"
          label="E-postadress"
          type="email"
          placeholder="namn@exempel.se"
          autoComplete="email"
          icon={MailIcon}
          value={email}
          onChange={setEmail}
          required
        />
        <PasswordField
          id="auth-new-password"
          label="Lösenord"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          required
        />
        <PasswordField
          id="auth-confirm-password"
          label="Bekräfta lösenord"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
        />
      </div>
      <div className="mt-4">
        <Checkbox id="auth-terms" checked={agree} onChange={setAgree}>
          Jag godkänner{" "}
          <a
            href="#"
            className="font-medium text-green-400 underline underline-offset-4 transition hover:text-green-300"
          >
            villkoren
          </a>{" "}
          och{" "}
          <a
            href="#"
            className="font-medium text-green-400 underline underline-offset-4 transition hover:text-green-300"
          >
            integritetspolicyn
          </a>
        </Checkbox>
      </div>
      <ErrorMessage message={error} />
      <SubmitButton disabled={loading}>{loading ? "Skapar konto..." : "Skapa konto"}</SubmitButton>
    </form>
  );
}

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const router = useRouter();

  function handleAuthSuccess() {
    onClose();
    router.push("/dashboard");
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
      aria-label={login ? "Logga in" : "Skapa konto"}
    >
      <div
        className="fixed inset-0 animate-overlay-fade-in bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        className="relative flex min-h-full items-stretch justify-center lg:items-center lg:p-8"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="animate-modal-pop-in relative w-full overflow-hidden bg-[#0A0F0D] lg:w-[440px] lg:rounded-[20px] lg:border lg:border-white/10 lg:bg-[#0F1417] lg:shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          {/* Mobile: hero backdrop behind the whole screen */}
          <div className="absolute inset-0 lg:hidden" aria-hidden="true">
            <Image
              src="/hero-background.png"
              alt=""
              fill
              className="object-cover object-top"
            />
            <div className="absolute inset-0 bg-black/70" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(10,15,13,0.55)_0%,rgba(10,15,13,0.35)_30%,rgba(10,15,13,0.8)_75%,rgba(10,15,13,0.95)_100%)]" />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="absolute right-4 top-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/5 hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>

          <div className="relative px-5 pb-10 pt-7 lg:px-7 lg:pb-7 lg:pt-7">
            {/* Mobile brand */}
            <div className="flex items-center justify-center gap-2.5 lg:hidden">
              <HouseIcon className="h-7 w-7 text-green-400" />
              <span className="text-xl font-semibold tracking-tight text-white">
                Köpanalys
              </span>
            </div>

            <div key={mode} className="animate-fade-in-up">
              {/* Mobile headline */}
              <div className="mt-10 text-center lg:hidden">
                <h2 className="text-[28px] font-bold leading-[1.3] tracking-tight text-white">
                  {login ? (
                    <>
                      Välkommen tillbaka!
                      <br />
                      Logga in för att <span className="text-green-400">fortsätta.</span>
                    </>
                  ) : (
                    <>
                      Skapa ditt konto
                      <br />
                      och kom igång <span className="text-green-400">direkt.</span>
                    </>
                  )}
                </h2>
                <p className="mx-auto mt-4 max-w-[300px] text-[15px] leading-relaxed text-neutral-300">
                  {login
                    ? "Få tillgång till analyser, bevakningar och personliga insikter."
                    : "Det tar mindre än en minut och du kan börja analysera direkt."}
                </p>
              </div>

              {/* Desktop headline */}
              <div className="hidden lg:block lg:pr-10">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  {login ? "Välkommen tillbaka!" : "Skapa ditt konto"}
                </h2>
                <p className="mt-1.5 text-sm text-neutral-400">
                  {login
                    ? "Logga in för att fortsätta till dina analyser."
                    : "Det tar mindre än en minut att komma igång."}
                </p>
              </div>

              <div className="mt-8 rounded-[24px] border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl lg:mt-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                {login ? (
                  <LoginForm onSuccess={handleAuthSuccess} />
                ) : (
                  <RegisterForm onSuccess={handleAuthSuccess} />
                )}
              </div>

              <p className="mt-7 text-center text-[15px] text-neutral-300 lg:mt-6 lg:text-sm lg:text-neutral-400">
                {login ? "Har du inget konto? " : "Har du redan ett konto? "}
                <button
                  type="button"
                  onClick={() => setMode(login ? "register" : "login")}
                  className="cursor-pointer font-semibold text-green-400 transition hover:text-green-300"
                >
                  {login ? "Skapa konto" : "Logga in"}
                </button>
              </p>
            </div>

            {/* Mobile trust footer */}
            <div className="mt-12 text-center lg:hidden">
              <p className="flex items-center justify-center gap-2 text-[15px] font-medium text-white">
                <ShieldIcon className="h-5 w-5 text-green-400" />
                Säker och trygg inloggning
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Vi skyddar dina uppgifter med högsta säkerhet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
