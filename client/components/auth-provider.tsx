"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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
const APP_ROLES = new Set<Role>(["citizen", "ngo_staff", "government_staff", "admin"]);

function normalizeRole(role: unknown): Role {
  return typeof role === "string" && APP_ROLES.has(role as Role)
    ? (role as Role)
    : "citizen";
}

function resolveAlias(session: Session): string {
  const metadataAlias =
    typeof session.user.user_metadata?.public_alias === "string"
      ? session.user.user_metadata.public_alias.trim()
      : "";
  const emailAlias = session.user.email?.split("@")[0]?.trim() ?? "";
  const fallbackAlias = `user-${session.user.id.slice(0, 8)}`;
  const alias = metadataAlias || emailAlias || fallbackAlias;

  return alias.length >= 3 ? alias : `${alias}${"-".repeat(3 - alias.length)}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const meRef = useRef<MeResponse | null>(null);
  const loadedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  const refreshProfile = useCallback(
    async (nextSession?: Session | null) => {
      const activeSession = nextSession ?? sessionRef.current;

      if (!activeSession?.access_token) {
        loadedTokenRef.current = null;
        setMe(null);
        return;
      }

      const accessToken = activeSession.access_token;

      if (nextSession && loadedTokenRef.current === accessToken && meRef.current) {
        return;
      }

      try {
        const profile = await apiFetch<MeResponse>("/me", {
          accessToken,
        });

        if (!profile.user.onboardingComplete) {
          if (normalizeRole(profile.user.role) !== "citizen") {
            loadedTokenRef.current = accessToken;
            setMe(profile);
            return;
          }

          try {
            await apiFetch("/profiles/register", {
              method: "POST",
              accessToken,
              body: JSON.stringify({
                publicAlias: resolveAlias(activeSession),
                preferredLanguage: "en",
                anonymousByDefault: true,
              }),
            });

            const hydratedProfile = await apiFetch<MeResponse>("/me", {
              accessToken,
            });
            loadedTokenRef.current = accessToken;
            setMe(hydratedProfile);
          } catch (profileError) {
            console.error("Profile bootstrap failed", profileError);
            loadedTokenRef.current = accessToken;
            setMe(profile);
          }
          return;
        }

        loadedTokenRef.current = accessToken;
        setMe(profile);
      } catch (profileError) {
        console.error("Profile refresh failed", profileError);
        loadedTokenRef.current = null;
        setMe(null);
      }
    },
    [],
  );

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
  }, [refreshProfile]);

  const value: AuthContextValue = {
    session,
    me,
    loading,
    refreshProfile: () => refreshProfile(),
    signOut: () => supabase.auth.signOut().then(() => undefined),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
