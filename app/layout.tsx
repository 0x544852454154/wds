import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "@ world domination$",
  description: "exclusive, @wd$",
  applicationName: "world domination",
  authors: [{ name: "world domination" }],
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    title: "@ world domination$",
    description: "exclusive, @wd$",
    type: "website",
    images: [
      {
        url: "https://file.garden/am9m147l3hw3nqT1/wdsbanner.gif",
        type: "image/gif",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "@ world domination$",
    description: "exclusive, @wd$",
    images: ["https://file.garden/am9m147l3hw3nqT1/wdsbanner.gif"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Tell crawlers and referral sources not to retain or redistribute this page. */}
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
        <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="referrer" content="no-referrer" />
      </head>
      <body>{children}</body>
    </html>
  );
}