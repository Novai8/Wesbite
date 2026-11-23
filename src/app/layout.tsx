import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Serif, Inter_Tight } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ChromeGate } from "@/components/chrome-gate";
import { site } from "@/lib/site";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-bricolage",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.title,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    title: site.title,
    description: site.description,
    url: site.url,
    siteName: site.name,
    type: "website",
  },
  robots: { index: true, follow: true },
  other: {
    "mitgo-verification": "acf3ba90-9321-4a9a-93ba-0c743663033e",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a36f2",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${bricolage.variable} ${interTight.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <ChromeGate slot="header">
          <SiteHeader />
        </ChromeGate>
        <main id="content" className="page-shell">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
