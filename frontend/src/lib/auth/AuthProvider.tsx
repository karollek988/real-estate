"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  signInWithGoogle,
  signInWithPassword,
  signOut as signOutRequest,
  signUpWithPassword,
} from "@/lib/auth/authService";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: typeof signInWithPassword;
  signUp: typeof signUpWithPassword;
  signInWithGoogle: typeof signInWithGoogle;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    signIn: signInWithPassword,
    signUp: signUpWithPassword,
    signInWithGoogle,
    signOut: async () => {
      await signOutRequest();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
