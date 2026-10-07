import { createClient } from "@/lib/supabase/client";

export function signUpWithPassword(email: string, password: string, fullName: string, firstName: string, locale: string) {
  const supabase = createClient();
  return supabase.auth.signUp({
    email,
    password,
    options: {
      // `locale`: the language the visitor was reading, so the confirmation e-mail (api/auth/send-email) and
      // the page they land on afterwards (auth/confirm) can be in it.
      data: { full_name: fullName, first_name: firstName, locale },
      // Destination after the confirmation link is clicked and verified by
      // /auth/confirm — not /auth/callback, which is the OAuth code-exchange
      // route used by signInWithGoogle below.
      emailRedirectTo: `${window.location.origin}/auth/confirmed`,
    },
  });
}

export function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export function resendSignupConfirmation(email: string) {
  const supabase = createClient();
  return supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
  });
}

export function signInWithGoogle() {
  const supabase = createClient();
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export function signOut() {
  const supabase = createClient();
  return supabase.auth.signOut();
}
