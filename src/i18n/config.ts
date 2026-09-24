export const LOCALES = ["en", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const HTML_LANG: Record<Locale, string> = { en: "en", pt: "pt-BR" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Picks the best supported locale from an Accept-Language header (RFC 9110 q-values). */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .slice(0, 512)
    .split(",")
    .slice(0, 20)
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => /^\s*q=([01](?:\.\d{1,3})?)\s*$/.exec(p)?.[1]).find(Boolean);
      return { base: tag.trim().toLowerCase().split("-")[0] ?? "", q: q ? Number(q) : 1, index };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  return ranked.find((entry) => isLocale(entry.base))?.base as Locale | undefined ?? DEFAULT_LOCALE;
}
