"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.signOut().finally(() => {
      router.replace("/");
    });
  }, [router]);

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-6 py-10">
      <div className="panel w-full max-w-lg rounded-[32px] border border-white/60 p-10 text-center shadow-[var(--shadow)]">
        <p className="eyebrow">Session</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink)]">
          Signing you out
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          Your Supabase session is being cleared and you&apos;ll return to the main feed in a moment.
        </p>
      </div>
    </main>
  );
}
