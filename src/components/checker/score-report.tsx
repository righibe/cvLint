import type { AnalysisResult, Category, Finding, Severity } from "@/lib/ats/types";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { formatFinding } from "./format-finding";

type ReportDict = Pick<Dictionary, "report" | "findings" | "sectionNames" | "languages">;

const CATEGORY_ORDER: Category[] = ["keywords", "parseability", "sections", "content", "contact"];

export type Band = "excellent" | "good" | "fair" | "poor";

export function scoreBand(score: number): Band {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "badge badge-critical",
  warning: "badge badge-warning",
  info: "badge badge-info",
  pass: "badge badge-pass",
};

/** Width comes from an SVG attribute, not an inline style, so the strict CSP allows it. */
function Bar({ value }: { value: number }) {
  return (
    <span className="bar" aria-hidden="true">
      <svg viewBox="0 0 100 4" preserveAspectRatio="none">
        <rect width={value} height="4" />
      </svg>
    </span>
  );
}

function FindingList({ items, dict }: { items: Finding[]; dict: ReportDict }) {
  return (
    <ul className="findings">
      {items.map((finding, i) => (
        <li className="finding" key={`${finding.id}-${i}`}>
          <span className={SEVERITY_CLASS[finding.severity]}>{dict.report.severity[finding.severity]}</span>
          <span>{formatFinding(finding, dict)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ScoreReport({ result, extractedText, dict }: { result: AnalysisResult; extractedText: string; dict: ReportDict }) {
  const { report } = dict;
  const band = scoreBand(result.score);
  const issues = result.findings.filter((f) => f.severity !== "pass");
  const passed = result.findings.filter((f) => f.severity === "pass");

  return (
    <div className="stack">
      <section className="card" aria-labelledby="score-title">
        <h2 id="score-title">
          {report.scoreTitle} · {report.bands[band]}
        </h2>
        <div className="score-head">
          <p className="score-value" data-band={band} role="img" aria-label={`${report.scoreTitle}: ${result.score}/100`}>
            <strong>{result.score}</strong>
            <span>/ 100</span>
          </p>
          <dl className="categories">
            {CATEGORY_ORDER.map((category) => {
              const value = result.categories[category];
              if (!value) return null;
              return (
                <div className="category-row" key={category}>
                  <dt>{report.categories[category]}</dt>
                  <dd>
                    <Bar value={value.score} />
                    <span className="num">{value.score}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
        <p className="help">
          {dict.languages[result.language.resume]} · {result.stats.words} {report.words} · {report.disclaimer}
        </p>
      </section>

      <section className="card" aria-labelledby="findings-title">
        <h2 id="findings-title">{report.findingsTitle}</h2>
        <FindingList items={issues} dict={dict} />
        {passed.length > 0 && (
          <details className="passed">
            <summary>{report.passed.replace("{count}", String(passed.length))}</summary>
            <FindingList items={passed} dict={dict} />
          </details>
        )}
      </section>

      <section className="card" aria-labelledby="keywords-title">
        <h2 id="keywords-title">{report.keywordsTitle}</h2>
        {result.keywords ? (
          <>
            <h3 className="label">
              {report.missing} ({result.keywords.missing.length})
            </h3>
            <ul className="chips">
              {result.keywords.missing.map((k) => (
                <li className="chip chip-miss" key={k.term}>
                  {k.term}
                </li>
              ))}
            </ul>
            <h3 className="label">
              {report.matched} ({result.keywords.matched.length})
            </h3>
            <ul className="chips">
              {result.keywords.matched.map((k) => (
                <li className="chip chip-hit" key={k.term}>
                  {k.term}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="help">{report.noJob}</p>
        )}
      </section>

      <details className="card extracted-box">
        <summary>{report.extractedTitle}</summary>
        <p className="help">{report.extractedHelp}</p>
        <pre className="extracted">{extractedText}</pre>
      </details>
    </div>
  );
}
