// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking — app must not be framed
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Enforce HTTPS
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Control referrer leakage to external links (ToS/Privacy PDFs)
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser features the app does not use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // CSP: restrict object/base/form/frame-ancestors (safe subset that won't break
  // Next.js inline hydration scripts or Tailwind inline styles).
  // connect-src whitelists Firebase callable endpoints. Both *.cloudfunctions.net
  // and *.run.app must be present — Cloud Functions Gen 2 transparently routes
  // through Cloud Run and either domain may be used for any given call. Without
  // *.run.app, invitation CFs fail silently in production only (see Lesson 24).
  // *.vercel.app deliberately omitted — preview-URL CF calls fail CORS by suite
  // convention; only prod + localhost are first-class targets (Lesson 68).
  {
    key: 'Content-Security-Policy',
    value: [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "connect-src 'self' https://*.cloudfunctions.net https://*.run.app https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
