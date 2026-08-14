import { createClient } from "@/lib/supabase/client";

export function signUpWithPassword(email: string, password: string, fullName: string, firstName: string) {
  const supabase = createClient();
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, first_name: firstName },
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
