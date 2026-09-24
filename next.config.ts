import type { NextConfig } from "next";

// Headers that do not depend on the per-request nonce. The page CSP lives in src/proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), browsing-topics=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

// The PDF.js worker parses untrusted files. It needs no network, no eval and no
// sub-resources, so it runs under a lock-down policy of its own.
const pdfWorkerCsp = "default-src 'none'; script-src 'self'; worker-src 'none'; connect-src 'none'; base-uri 'none'";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Versioned file name (see scripts/copy-pdf-worker.mjs), so it can be cached forever.
        source: "/pdfjs/:file(pdf\\.worker\\.[0-9.]+\\.min\\.mjs)",
        headers: [
          { key: "Content-Security-Policy", value: pdfWorkerCsp },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Static assets skip the proxy; if one of these URLs ever yields an HTML error
        // page, it still cannot run anything.
        source: "/_next/static/:path*",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" }],
      },
    ];
  },
};

export default nextConfig;
