import "@/lib/env";

import type { Metadata } from "next";

import { AppFrame } from "@/components/app-frame";
import { AuthProvider } from "@/components/auth-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "CivicSignal",
  description:
    "Realtime civic issue reporting with anonymous posts, ranked feeds, and institution dashboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppFrame>{children}</AppFrame>
        </AuthProvider>
      </body>
    </html>
  );
}
