import { CATEGORY_ORDER, scoreBand } from "@/lib/ats/band";
import type { AnalysisResult } from "@/lib/ats/types";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { formatFinding } from "./format-finding";

type Dict = Pick<Dictionary, "report" | "findings" | "sectionNames" | "languages" | "personalData">;

/** The report as plain Markdown, to paste into notes, an issue or a chat with a mentor. */
export function reportToMarkdown(result: AnalysisResult, dict: Dict): string {
  const { report } = dict;
  const issues = result.findings.filter((f) => f.severity !== "pass");
  const passed = result.findings.filter((f) => f.severity === "pass");
  const line = (f: (typeof result.findings)[number]) => `- [${report.severity[f.severity]}] ${formatFinding(f, dict)}`;

  const out = [
    `# cvlint · ${report.scoreTitle}: ${result.score}/100 (${report.bands[scoreBand(result.score)]})`,
    "",
    `${dict.languages[result.language.resume]} · ${result.stats.words} ${report.words} · ${report.disclaimer}`,
    "",
  ];
  for (const category of CATEGORY_ORDER) {
    const value = result.categories[category];
    if (value) out.push(`- ${report.categories[category]}: ${value.score}/100 (${report.weight} ${Math.round(value.weight * 100)}%)`);
  }

  if (issues.length > 0) out.push("", `## ${report.findingsTitle}`, "", ...issues.map(line));
  if (passed.length > 0) out.push("", `## ${report.passed.replace("{count}", String(passed.length))}`, "", ...passed.map(line));

  if (result.keywords) {
    const terms = (hits: { term: string }[]) => hits.map((k) => k.term).join(", ") || "–";
    out.push(
      "",
      `## ${report.keywordsTitle}`,
      "",
      `- ${report.missing} (${result.keywords.missing.length}): ${terms(result.keywords.missing)}`,
      `- ${report.matched} (${result.keywords.matched.length}): ${terms(result.keywords.matched)}`,
    );
  }
  return `${out.join("\n")}\n`;
}
