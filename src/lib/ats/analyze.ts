import { RESUME_HEADINGS } from "../resume/format";
import { normalizeText } from "../text/normalize";
import { detectContact } from "./contact";
import { analyzeContent } from "./content";
import { extractJobKeywords, indexText, matchKeywords } from "./keywords";
import { detectLanguage } from "./language";
import type { SectionId } from "./lexicon";
import { detectSections } from "./sections";
import {
  EMPTY_LAYOUT,
  type AnalysisInput,
  type AnalysisResult,
  type Category,
  type CategoryScore,
  type Finding,
  type FindingId,
  type FindingParams,
  type Lang,
  type Severity,
} from "./types";

export const WEIGHTS_WITH_JOB: Record<Category, number> = {
  keywords: 0.35,
  parseability: 0.25,
  sections: 0.15,
  content: 0.15,
  contact: 0.1,
};

export const WEIGHTS_WITHOUT_JOB: Record<Category, number> = {
  keywords: 0,
  parseability: 0.35,
  sections: 0.25,
  content: 0.25,
  contact: 0.15,
};

function headingFor(lang: Lang, id: SectionId): string {
  const h = RESUME_HEADINGS[lang];
  return id === "certifications" ? h.certificates : h[id];
}

// Scanned/image PDFs yield (almost) no words; short but real text still gets a full report.
const MIN_READABLE_WORDS = 10;
const MAX_JOB_CHARS = 20_000;
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2, pass: 3 };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

class FindingList {
  readonly items: Finding[] = [];
  add(category: Category, id: FindingId, severity: Severity, params?: FindingParams) {
    this.items.push(params ? { id, severity, category, params } : { id, severity, category });
  }
}

export function analyzeResume(input: AnalysisInput): AnalysisResult {
  const { text } = normalizeText(input.resumeText);
  const jobText = normalizeText(input.jobText ?? "", MAX_JOB_CHARS).text;
  const layout = { ...EMPTY_LAYOUT, ...input.layout };
  const findings = new FindingList();
  const content = analyzeContent(text);
  const hasJob = jobText.trim().length > 0;
  const language = { resume: detectLanguage(text), job: hasJob ? detectLanguage(jobText) : null };
  const stats = { words: content.words, lines: content.lines, bullets: content.bullets };

  // ---- Parseability -------------------------------------------------------------
  if (content.words < MIN_READABLE_WORDS) {
    findings.add("parseability", "text.empty", "critical");
    return {
      score: 0,
      categories: { parseability: { score: 0, weight: 1 }, sections: null, contact: null, content: null, keywords: null },
      findings: findings.items,
      keywords: null,
      language,
      stats,
    };
  }

  let parse = 100;
  findings.add("parseability", "text.readable", "pass", { words: content.words });
  if (content.words < 150) {
    parse -= 15;
    findings.add("parseability", "text.short", "warning", { words: content.words });
  } else if (content.words > 1300) {
    parse -= 10;
    findings.add("parseability", "text.long", "warning", { words: content.words });
  }
  if (content.garbled >= 3) {
    parse -= Math.min(25, 5 + content.garbled);
    findings.add("parseability", "text.garbled", "warning", { count: content.garbled });
  }
  if (input.truncated) findings.add("parseability", "text.truncated", "info");
  if (layout.tables > 0) {
    parse -= layout.tables > 1 ? 15 : 10;
    findings.add("parseability", "layout.tables", "warning", { count: layout.tables });
  }
  if (layout.textBoxes > 0) {
    parse -= 15;
    findings.add("parseability", "layout.textBoxes", "warning", { count: layout.textBoxes });
  }
  if (layout.columns) {
    parse -= 20;
    findings.add("parseability", "layout.columns", "warning");
  }
  if (layout.images > 0) findings.add("parseability", "layout.images", "info", { count: layout.images });
  if (layout.pageCount !== null && layout.pageCount > 2) {
    parse -= 10;
    findings.add("parseability", "layout.pages", "warning", { count: layout.pageCount });
  }

  // ---- Contact ------------------------------------------------------------------
  const contact = detectContact(text);
  const hidden = input.headerFooterText ? detectContact(input.headerFooterText) : null;
  let contactScore = 0;
  if (contact.email) {
    contactScore += 45;
    findings.add("contact", "contact.email", "pass");
  } else if (hidden?.email) {
    contactScore += 20;
  } else {
    findings.add("contact", "contact.emailMissing", "critical");
  }
  if (contact.phone) {
    contactScore += 30;
    findings.add("contact", "contact.phone", "pass");
  } else if (hidden?.phone) {
    contactScore += 15;
  } else {
    findings.add("contact", "contact.phoneMissing", "warning");
  }
  if ((hidden?.email && !contact.email) || (hidden?.phone && !contact.phone)) {
    parse -= 10;
    findings.add("parseability", "layout.headerFooterContact", "warning");
  }
  if (contact.linkedin === "url") {
    contactScore += 25;
    findings.add("contact", "contact.linkedin", "pass");
  } else if (contact.linkedin === "label") {
    contactScore += 10;
    findings.add("contact", "contact.linkedinHidden", "info");
  } else {
    findings.add("contact", "contact.linkedinMissing", "info");
  }

  // ---- Sections -----------------------------------------------------------------
  const sections = detectSections(text);
  // A heading hidden behind an icon glyph may or may not be recognized: half credit.
  const credit = (id: SectionId) =>
    sections.found.includes(id) ? 1 : sections.decorated.some((d) => d.section === id) ? 0.5 : 0;
  let sectionScore = 0;
  if (sections.found.length > 0) findings.add("sections", "sections.found", "pass", { sections: sections.found.join(",") });
  for (const d of sections.decorated) {
    findings.add("sections", "sections.decorated", "warning", { heading: d.heading.slice(0, 60), section: d.section });
  }
  for (const [id, points] of [["experience", 30], ["education", 20], ["skills", 25]] as const) {
    sectionScore += points * credit(id);
    if (credit(id) === 0) findings.add("sections", "sections.missing", "warning", { section: id });
  }
  sectionScore += 15 * credit("summary");
  if (credit("summary") === 0) findings.add("sections", "sections.summaryMissing", "info");
  sectionScore += 10 * Math.max(credit("projects"), credit("certifications"), credit("languages"));
  for (const n of sections.nonstandard) {
    // Suggest the heading in the resume's own language when it is known.
    const suggestion = language.resume === "unknown" ? n.suggestion : headingFor(language.resume, n.suggestion);
    findings.add("sections", "sections.nonstandard", "info", { heading: n.heading.slice(0, 60), suggestion });
  }

  // ---- Content ------------------------------------------------------------------
  let contentScore = 0;
  contentScore += Math.min(content.quantified / 3, 1) * 35;
  if (content.quantified >= 3) findings.add("content", "content.quantified", "pass", { count: content.quantified });
  else findings.add("content", "content.quantifiedLow", "warning", { count: content.quantified });

  contentScore += Math.min(content.actionVerbs / 5, 1) * 25;
  if (content.actionVerbs >= 5) findings.add("content", "content.actionVerbs", "pass", { count: content.actionVerbs });
  else findings.add("content", "content.actionVerbsLow", "info", { count: content.actionVerbs });

  if (content.bullets >= 3) {
    contentScore += 15;
    findings.add("content", "content.bullets", "pass", { count: content.bullets });
  } else {
    findings.add("content", "content.bulletsMissing", "info");
  }

  if (content.years >= 2) contentScore += 25;
  else findings.add("content", "content.datesMissing", "warning");

  if (language.resume === "en" && content.firstPerson >= 4) {
    contentScore -= 10;
    findings.add("content", "content.pronouns", "info", { count: content.firstPerson });
  }

  // ---- Keywords -----------------------------------------------------------------
  let keywordScore: number | null = null;
  let keywords: AnalysisResult["keywords"] = null;
  if (hasJob) {
    const jobWords = indexText(jobText).tokens.length;
    if (jobWords < 40) findings.add("keywords", "keywords.jobShort", "info", { words: jobWords });

    if (language.job && language.job !== "unknown" && language.resume !== "unknown" && language.job !== language.resume) {
      findings.add("keywords", "language.mismatch", "warning", { resume: language.resume, job: language.job });
    }

    const jobKeywords = extractJobKeywords(jobText);
    if (jobKeywords.length > 0) {
      const match = matchKeywords(jobKeywords, indexText(text));
      keywordScore = match.score;
      keywords = { matched: match.matched, missing: match.missing };
      const severity: Severity = match.score >= 70 ? "pass" : match.score >= 45 ? "warning" : "critical";
      findings.add("keywords", "keywords.match", severity, {
        matched: match.matched.length,
        total: jobKeywords.length,
        percent: match.score,
      });
      if (match.missing.length > 0) {
        findings.add("keywords", "keywords.missing", match.score >= 70 ? "info" : "warning", {
          terms: match.missing
            .slice(0, 8)
            .map((k) => k.term)
            .join(", "),
        });
      }
      for (const s of match.stuffed.slice(0, 3)) {
        findings.add("keywords", "keywords.stuffing", "warning", { term: s.term, count: s.count });
      }
    }
  }

  // ---- Total --------------------------------------------------------------------
  const weights = keywordScore === null ? WEIGHTS_WITHOUT_JOB : WEIGHTS_WITH_JOB;
  const raw: Record<Category, number | null> = {
    parseability: clamp(parse),
    sections: clamp(sectionScore),
    contact: clamp(contactScore),
    content: clamp(contentScore),
    keywords: keywordScore === null ? null : clamp(keywordScore),
  };
  const categories = Object.fromEntries(
    (Object.keys(raw) as Category[]).map((c) => {
      const score = raw[c];
      return [c, score === null ? null : ({ score, weight: weights[c] } satisfies CategoryScore)];
    }),
  ) as Record<Category, CategoryScore | null>;

  const score = clamp(
    (Object.values(categories) as (CategoryScore | null)[]).reduce((sum, c) => sum + (c ? c.score * c.weight : 0), 0),
  );

  return {
    score,
    categories,
    findings: findings.items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    keywords,
    language,
    stats,
  };
}
