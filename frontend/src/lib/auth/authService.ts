import { createClient } from "@/lib/supabase/client";

export function signUpWithPassword(email: string, password: string, fullName: string) {
  const supabase = createClient();
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
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
