"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ENV } from "@/lib/env";
import { supabase } from "@/lib/supabaseClient";

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { session, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    alias: "",
  });

  useEffect(() => {
    if (session) {
      router.replace("/feed");
    }
  }, [router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "register") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${ENV.NEXT_PUBLIC_SITE_URL}/feed`,
            data: {
              public_alias: form.alias.trim(),
            },
          },
        });

        if (authError) throw authError;

        if (data.session) {
          await refreshProfile();
          router.push("/feed");
          return;
        }

        setMessage(
          "Registration submitted. Complete email verification if your Supabase project requires it.",
        );
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });

        if (authError) throw authError;
        await refreshProfile();
        router.push("/feed");
      }
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${ENV.NEXT_PUBLIC_SITE_URL}/feed`,
        },
      });

      if (authError) throw authError;
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Google sign-in failed.",
      );
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="surface rounded-[32px] border border-white/10 p-8">
        <p className="label-text">{mode === "login" ? "Login" : "Register"}</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] text-white">
          {mode === "login"
            ? "Access your civic workspace"
            : "Create an anonymous civic account"}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
          Use email or Google to authenticate with Supabase. Once you&apos;re in, the app
          takes you to the live feed and backend-powered post flows.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">Auth</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">Supabase session management</p>
          </div>
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">Posting</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">Create and manage civic issues</p>
          </div>
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">Response</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">Institution summaries and triage</p>
          </div>
        </div>
      </div>

      <div className="surface rounded-[32px] border border-white/10 p-8">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "register" && (
            <label className="block">
              <span className="label-text">Public alias</span>
              <input
                className="field mt-2"
                value={form.alias}
                onChange={(event) =>
                  setForm((current) => ({ ...current, alias: event.target.value }))
                }
                placeholder="street-watch-21"
              />
            </label>
          )}

          <label className="block">
            <span className="label-text">Email</span>
            <input
              className="field mt-2"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="name@example.com"
            />
          </label>

          <label className="block">
            <span className="label-text">Password</span>
            <input
              className="field mt-2"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Use a strong password"
            />
          </label>

          {error && (
            <div className="rounded-[22px] border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-[22px] border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              {message}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" disabled={busy} className="button-primary">
              {busy
                ? "Working..."
                : mode === "login"
                  ? "Continue with email"
                  : "Create account"}
            </button>
            <button type="button" disabled={busy} onClick={handleGoogle} className="button-secondary">
              Continue with Google
            </button>
          </div>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          {mode === "login" ? "Need an account?" : "Already registered?"}{" "}
          <Link href={mode === "login" ? "/register" : "/login"} className="text-cyan-300">
            {mode === "login" ? "Register here" : "Log in here"}
          </Link>
        </p>
      </div>
    </section>
  );
}
