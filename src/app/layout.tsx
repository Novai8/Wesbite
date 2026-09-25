import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { IntroLoader } from "@/components/intro-loader";
import { PageTransition } from "@/components/page-transition";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Cursor } from "@/components/ui/inverted-cursor";
import { site } from "@/lib/site";
import "./globals.css";

const instrument = localFont({
  src: [
    {
      path: "../fonts/InstrumentSerif-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/InstrumentSerif-Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.title,
    template: "%s · Rapigents",
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.owner, url: site.github }],
  creator: site.owner,
  openGraph: {
    title: site.title,
    description: site.description,
    url: site.url,
    siteName: site.name,
    type: "website",
    images: [
      {
        url: "/brand/og.png",
        width: 1200,
        height: 630,
        alt: "Rapigents RA logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
    images: ["/brand/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F7FB",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">
        <Providers>
          <Cursor />
          <IntroLoader />
          <a href="#content" className="skip-link">
            Skip to content
          </a>
          <SiteHeader />
          <PageTransition>
            {children}
            <SiteFooter />
          </PageTransition>
        </Providers>
      </body>
    </html>
  );
}
