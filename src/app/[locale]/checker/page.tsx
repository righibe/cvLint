import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckerTool } from "@/components/client-tools";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.checker.title,
    alternates: { canonical: `/${locale}/checker`, languages: { en: "/en/checker", "pt-BR": "/pt/checker" } },
  };
}

export default async function CheckerPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { checker, report, findings, errors, sectionNames, languages, common } = dict;

  return (
    <div className="container">
      <div className="page-head">
        <h1>{checker.title}</h1>
        <p>{checker.intro}</p>
      </div>
      <CheckerTool dict={{ checker, report, findings, errors, sectionNames, languages, common }} />
    </div>
  );
}
