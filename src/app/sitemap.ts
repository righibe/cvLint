import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/config";
import { siteUrl } from "@/lib/site";

const PATHS = ["", "/builder", "/checker"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PATHS.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: new URL(`/${locale}${path}`, base).href,
      alternates: { languages: { en: new URL(`/en${path}`, base).href, "pt-BR": new URL(`/pt${path}`, base).href } },
    })),
  );
}
