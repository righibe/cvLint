"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { HTML_LANG, type Locale } from "@/i18n/config";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link href={href} aria-current={pathname === href ? "page" : undefined}>
      {children}
    </Link>
  );
}

export function LanguageSwitch({ locale, label, ariaLabel }: { locale: Locale; label: string; ariaLabel: string }) {
  const pathname = usePathname();
  const target: Locale = locale === "en" ? "pt" : "en";
  const rest = pathname.replace(/^\/(en|pt)(?=\/|$)/, "");
  return (
    <Link className="lang-switch" href={`/${target}${rest}`} hrefLang={HTML_LANG[target]} lang={HTML_LANG[target]} aria-label={ariaLabel}>
      {label}
    </Link>
  );
}
