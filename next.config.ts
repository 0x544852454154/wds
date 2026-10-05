import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: isProd
      ? { exclude: ["error", "warn"] }
      : false,
  },
  generateEtags: true,
  async headers() {
    // Serverless responses must not be CDN-cached: the SSE stream is long-lived
    // and per-connection, and a cached variant would pin one visitor's
    // presence onto every other visitor.
    const noStore = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
      { key: "CDN-Cache-Control", value: "no-store" },
      { key: "Vercel-CDN-Cache-Control", value: "no-store" },
    ];

    const csp = [
      "default-src 'self'",
      // Next injects inline bootstrap scripts for hydration; the hashes are not
      // known at config time so nonce-free inline script is scoped tightly.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.discordapp.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net https://i.scdn.co blob:",
      "media-src 'self' https://file.garden blob:",
      "connect-src 'self' https://api.lanyard.rest wss://api.lanyard.rest",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/api/presence/:path*",
        headers: noStore,
      },
      {
        source: "/api/avatar/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "CDN-Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },

  // Serverless function sizing. The SSE relay is the only long-lived route and
  // needs more memory than the default, since it holds a WebSocket plus an
  // open response stream per invocation.
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
