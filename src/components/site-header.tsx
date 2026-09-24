import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { LanguageSwitch, NavLink } from "./nav-links";

export function SiteHeader({ locale, nav }: { locale: Locale; nav: Dictionary["nav"] }) {
  return (
    <header className="site-header">
      <div className="container">
        <Link className="brand" href={`/${locale}`}>
          <span className="brand-mark" aria-hidden="true" />
          cvlint
        </Link>
        <nav className="site-nav" aria-label={nav.label}>
          <NavLink href={`/${locale}/checker`}>{nav.checker}</NavLink>
          <NavLink href={`/${locale}/builder`}>{nav.builder}</NavLink>
          <LanguageSwitch locale={locale} label={nav.switchTo} ariaLabel={nav.switchLabel} />
        </nav>
      </div>
    </header>
  );
}
