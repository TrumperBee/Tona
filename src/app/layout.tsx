// GCC - root layout: fonts, metadata and the document shell.
// Route-group layouts add navigation and access control.
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";
import { SITE_NAME, SITE_SHORT_NAME, SITE_TAGLINE, siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Condensed, athletic display face for headings - deliberately not a UI-dashboard font.
const displayFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const defaultTitle = `${SITE_NAME} | ${SITE_TAGLINE}`;
const socialImage = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Global Champions Circuit - One Platform. Endless Competition.",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: defaultTitle,
    template: `%s | ${SITE_SHORT_NAME}`,
  },
  description: siteConfig.description,
  applicationName: SITE_NAME,
  category: "sports",
  keywords: [
    "football gaming",
    "tournament platform",
    "eFootball",
    "EA SPORTS FC",
    "Dream League Soccer",
    "league phase",
    "football esports",
    "community tournaments",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon-32.png"],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: SITE_NAME,
    title: defaultTitle,
    description: siteConfig.description,
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: siteConfig.description,
    images: [socialImage.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#050F1F",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(bodyFont.variable, displayFont.variable)}>
      <body className="min-h-dvh font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
