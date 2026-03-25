'use client';
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Logout() {
  const router = useRouter();

  // LogOut as soon as this page is called
  useEffect(() => {
    supabase.auth.signOut().finally(() => {
      
      // Redirect to home page after signout
      router.replace("/");
    });
  }, []);

  return (
    <div>
      <p>Signing out</p>
    </div>
  );
}
