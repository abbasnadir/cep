"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import type { MeResponse, Role } from "@/lib/types";

type AuthContextValue = {
  session: Session | null;
  me: MeResponse | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function buildFallbackProfile(session: Session): MeResponse {
  const email = session.user.email ?? null;
  const publicAlias =
    typeof session.user.user_metadata?.public_alias === "string"
      ? session.user.user_metadata.public_alias
      : email?.split("@")[0] ?? "anonymous-user";
  const role =
    typeof session.user.user_metadata?.role === "string"
      ? (session.user.user_metadata.role as Role)
      : "citizen";

  return {
    user: {
      id: session.user.id,
      email,
      role,
      onboardingComplete: true,
    },
    profile: {
      id: session.user.id,
      role,
      publicAlias,
      anonymousByDefault: true,
      preferredLanguage: "en",
      onboardingComplete: true,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile(nextSession = session) {
    if (!nextSession?.access_token) {
      setMe(null);
      return;
    }

    try {
      const profile = await apiFetch<MeResponse>("/me", {
        accessToken: nextSession.access_token,
      });
      setMe(profile);
    } catch {
      setMe(buildFallbackProfile(nextSession));
    }
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;

      setSession(data.session ?? null);
      if (data.session) {
        await refreshProfile(data.session);
      } else {
        setMe(null);
      }
      if (active) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        await refreshProfile(nextSession);
      } else {
        setMe(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      me,
      loading,
      refreshProfile: () => refreshProfile(),
      signOut: () => supabase.auth.signOut().then(() => undefined),
    }),
    [loading, me, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
