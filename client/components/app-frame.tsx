"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { HelpChatWidget } from "@/components/help-chat-widget";

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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                UF
              </span>
              <span>
                <span className="block text-xl font-semibold tracking-[-0.03em] text-slate-900">UrbanFix</span>
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
                <div className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 sm:block">
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
      <HelpChatWidget />
    </div>
  );
}
