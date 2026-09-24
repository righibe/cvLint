import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuilderTool } from "@/components/client-tools";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.builder.title,
    alternates: { canonical: `/${locale}/builder`, languages: { en: "/en/builder", "pt-BR": "/pt/builder" } },
  };
}

export default async function BuilderPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { builder } = getDictionary(locale);

  return (
    <div className="container">
      <div className="page-head no-print">
        <h1>{builder.title}</h1>
        <p>{builder.intro}</p>
      </div>
      <BuilderTool dict={builder} locale={locale} />
    </div>
  );
}
