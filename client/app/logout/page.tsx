"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { StateBlock } from "@/components/state-block";

export default function LogoutPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    signOut().finally(() => {
      router.replace("/");
    });
  }, [router, signOut]);

  return (
    <div className="mx-auto max-w-2xl">
      <StateBlock
        title="Signing you out"
        description="Your Supabase session is being cleared. You will be returned to the landing page in a moment."
      />
    </div>
  );
}
