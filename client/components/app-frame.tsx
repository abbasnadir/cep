"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

const navLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/posts/new", label: "New Post" },
  { href: "/institution", label: "Institution" },
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, session } = useAuth();

  return (
    <div className="page-wrap">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-semibold tracking-[-0.04em] text-white">
              CivicSignal
            </Link>
            <nav className="hidden items-center gap-2 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="pill-button"
                  data-active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <>
                <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 sm:block">
                  {me?.profile.publicAlias ?? session.user.email}
                </div>
                <Link href="/logout" className="button-secondary">
                  Logout
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="button-ghost">
                  Login
                </Link>
                <Link href="/register" className="button-primary">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
