import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { home } = getDictionary(locale);

  return (
    <div className="container">
      <section className="hero">
        <p className="label-caps">{home.eyebrow}</p>
        <h1>{home.title}</h1>
        <p className="lead">{home.subtitle}</p>
        <div className="btn-row">
          <Link className="btn btn-primary" href={`/${locale}/checker`}>
            {home.ctaChecker}
          </Link>
          <Link className="btn" href={`/${locale}/builder`}>
            {home.ctaBuilder}
          </Link>
        </div>
      </section>

      <div className="points">
        {home.points.map((point, i) => (
          <section className="point" key={point.title}>
            <p className="label-caps">{String(i + 1).padStart(2, "0")}</p>
            <h2>{point.title}</h2>
            <p>{point.text}</p>
          </section>
        ))}
      </div>

      <details className="scoring">
        <summary>{home.scoringTitle}</summary>
        <ul className="weights">
          {home.scoringItems.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <span className="pct">{item.weight}</span>
              <span className="why">{item.text}</span>
            </li>
          ))}
        </ul>
        <p className="help">{home.scoringNote}</p>
      </details>
    </div>
  );
}
