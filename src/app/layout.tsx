// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Metadata } from "next";
import localFont from "next/font/local";
import { APP_DESCRIPTION } from "@/lib/constants";
import { THEME_SCRIPT } from "@/lib/theme";
import { ThemeSync } from "@/components/theme-sync";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SPERT® CFD",
  // The header's tagline, so the two cannot drift apart (v0.17.9).
  description: `SPERT® CFD — ${APP_DESCRIPTION}`,
  icons: {
    icon: '/spert-favicon-cfd.png',
    apple: '/spert-favicon-cfd.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // v0.20.0 (DASH26 RD2): the pre-paint script sets the `dark` class before
  // the first frame, from the stored preference (theme.ts), so a dark visitor
  // never sees a light page first. `suppressHydrationWarning` because that
  // class is on <html> before React hydrates it; it covers <html>'s own
  // attributes only. ThemeSync keeps the class right afterwards, on every route.
  // v0.22.0 (FRAME26): the SPERT® Suite frame holds every route. Held HERE, by
  // the layout, so it never remounts between "/" and "/changelog": the tab and
  // the notices' dismissals survive the visit. "/" renders the tabs (AppShell's
  // own state); every other route renders its page inside the frame's main.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-black dark:bg-gray-900 dark:text-gray-100`}
      >
        <ThemeSync />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
