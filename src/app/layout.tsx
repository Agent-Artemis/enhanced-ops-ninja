import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";
import { SITE_URL, organizationSchema, websiteSchema, jsonLd } from "@/lib/seo/structured-data";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // The homepage sets its own title; every OTHER route inherits this default.
  // It previously read "Enhanced Ops × Ninja — AI Automation & Consulting",
  // which described a positioning we no longer sell and split the brand name
  // into "Enhanced Ops" — the exact string we never use. That default is what
  // an assistant reads for any non-homepage URL, so it was actively teaching
  // models the wrong company.
  title: {
    default: "EnhancedOps.Ninja — Command Center for Multi-Location Operators",
    template: "%s | EnhancedOps.Ninja",
  },
  description:
    "EnhancedOps.Ninja pulls your scattered systems into one clean command center — turning raw data into leverage over time, money, staffing, and patient and client care.",
  applicationName: "EnhancedOps.Ninja",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "EnhancedOps.Ninja",
    url: SITE_URL,
    title: "EnhancedOps.Ninja — Command Center for Multi-Location Operators",
    description:
      "One screen, every location, live. Command center, operating system and survey readiness for multi-location operators.",
    images: [{ url: "/logo-ninja.png", alt: "EnhancedOps.Ninja" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "EnhancedOps.Ninja — Command Center for Multi-Location Operators",
    description:
      "One screen, every location, live. Command center, operating system and survey readiness for multi-location operators.",
    images: ["/logo-ninja.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${dmSans.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        {/* Entity records for search + AI assistants. Site-wide, so every route
            resolves to the same organization rather than looking like a
            different company on each page. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteSchema) }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
