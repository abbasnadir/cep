"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

const navLinks = [
  { href: "/", label: "Feed" },
  { href: "/posts/new", label: "New Post" },
  { href: "/institution", label: "Institution" },
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, session } = useAuth();

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/" || pathname === "/feed";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="page-wrap">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
                CS
              </span>
              <span>
                <span className="block text-xl font-semibold tracking-[-0.04em] text-white">
                  CivicSignal
                </span>
                <span className="block text-xs uppercase tracking-[0.22em] text-slate-500">
                  Public civic stream
                </span>
              </span>
            </Link>
            <nav className="hidden items-center gap-2 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="pill-button"
                  data-active={isActive(link.href)}
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
                <Link href="/posts/new" className="button-primary hidden sm:inline-flex">
                  Post
                </Link>
                <Link href="/logout" className="button-secondary">
                  Logout
                </Link>
              </>
            ) : (
              <>
                <div className="hidden rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 md:block">
                  Guest browsing enabled
                </div>
                <Link href="/login" className="button-ghost">
                  Login
                </Link>
                <Link href="/register" className="button-primary">
                  Join now
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
