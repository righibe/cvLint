import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HTML_LANG, isLocale, LOCALES } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { siteUrl } from "@/lib/site";
import "../globals.css";

// Same type pair as righi.dev. next/font downloads the files at build time and serves
// them from this origin, so there is no runtime request to Google (CSP: font-src 'self').
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"], display: "swap" });

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#030408",
  colorScheme: "dark",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    metadataBase: siteUrl(),
    title: { default: dict.meta.title, template: `%s · cvlint` },
    description: dict.meta.description,
    applicationName: "cvlint",
    authors: [{ name: "Bernardo Righi", url: "https://righi.dev" }],
    creator: "Bernardo Righi",
    alternates: { canonical: `/${locale}`, languages: { en: "/en", "pt-BR": "/pt" } },
    openGraph: { title: dict.meta.title, description: dict.meta.description, type: "website", locale: HTML_LANG[locale] },
    robots: { index: true, follow: true },
    referrer: "no-referrer",
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  // Every page is rendered per request so it can carry the CSP nonce set by the proxy.
  await connection();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <html lang={HTML_LANG[locale]} className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          {dict.common.skipToContent}
        </a>
        <SiteHeader locale={locale} nav={dict.nav} />
        <main id="main">{children}</main>
        <SiteFooter footer={dict.footer} />
      </body>
    </html>
  );
}
