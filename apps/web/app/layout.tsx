import type React from "react";
import type { Metadata, Viewport } from "next";
import {
  Fira_Code,
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  Inconsolata,
  Inter,
  JetBrains_Mono,
  Merriweather,
  Noto_Color_Emoji,
  Playfair_Display,
  Source_Code_Pro,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@components/theme-provider";
import { Toaster } from "@components/ui/sonner";
import { PrivacyAnalytics } from "./privacy-analytics";

// Text fallback arrays are intentionally empty: next/font concatenates them
// inside each CSS variable, while globals.css composes the complete chain. The
// composed order must be primary text face, color emoji, then platform fallback.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  fallback: [],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  preload: false,
  fallback: [],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  preload: false,
  fallback: [],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  preload: false,
  fallback: [],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-family",
  fallback: [],
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-family",
  preload: false,
  fallback: [],
});

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-source-code-family",
  preload: false,
  fallback: [],
});

const inconsolata = Inconsolata({
  subsets: ["latin"],
  variable: "--font-inconsolata-family",
  preload: false,
  fallback: [],
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-family",
  preload: false,
  fallback: [],
});

const merriweather = Merriweather({
  subsets: ["latin"],
  variable: "--font-merriweather-family",
  preload: false,
  fallback: [],
});

// Color emoji are loaded on demand rather than preloaded: the full repertoire
// is much larger than a text subset, and export capture explicitly waits for
// document.fonts.ready before rasterizing frames.
const notoColorEmoji = Noto_Color_Emoji({
  weight: "400",
  subsets: ["emoji"],
  variable: "--font-emoji",
  preload: false,
  fallback: ["Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"],
});

const fallbackSiteUrl = "https://markdownvideo.avikmukherjee.com";
const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallbackSiteUrl,
).origin;
const ogImageUrl = new URL("/og-image.png", `${siteUrl}/`).toString();
const siteName = "Markdown Video";
const title = "Markdown Video - write markdown. render the video.";
const description =
  "Turn readable markdown into real MP4s in the browser editor, from the CLI, through the MCP server, or in GitHub Actions - with music, captions, and multi-locale output.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s | ${siteName}`,
  },
  description,
  applicationName: siteName,
  keywords: [
    "markdown",
    "video",
    "animation",
    "tutorial",
    "demo",
    "presentation",
    "code video",
    "developer tools",
    "video editor",
    "markdown to video",
    "animated code",
    "terminal animation",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title,
    description,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "A deep aubergine frame rendered from markdown with the text: this video is a text file.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "A deep aubergine frame rendered from markdown with the text: this video is a text file.",
      },
    ],
    creator: "@avikm744",
    site: "@avikm744",
  },
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
  manifest: "/site.webmanifest",
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff4ec" },
    { media: "(prefers-color-scheme: dark)", color: "#130a24" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${inter.variable} ${geistMono.variable} ${playfair.variable} ${jetbrainsMono.variable} ${firaCode.variable} ${sourceCodePro.variable} ${inconsolata.variable} ${ibmPlexMono.variable} ${merriweather.variable} ${notoColorEmoji.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster position="bottom-right" closeButton />
        </ThemeProvider>
        <PrivacyAnalytics />
      </body>
    </html>
  );
}
