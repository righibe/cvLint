export type Lang = "en" | "pt";
export type DetectedLang = Lang | "unknown";
export type SourceFormat = "pdf" | "docx" | "txt" | "text" | "builder";

export interface LayoutSignals {
  tables: number;
  textBoxes: number;
  images: number;
  columns: boolean;
  pageCount: number | null;
}

export const EMPTY_LAYOUT: LayoutSignals = { tables: 0, textBoxes: 0, images: 0, columns: false, pageCount: null };

export type Severity = "critical" | "warning" | "info" | "pass";
export type Category = "parseability" | "sections" | "contact" | "content" | "keywords";

export const FINDING_IDS = [
  "text.empty",
  "text.readable",
  "text.short",
  "text.long",
  "text.garbled",
  "text.truncated",
  "layout.tables",
  "layout.textBoxes",
  "layout.images",
  "layout.columns",
  "layout.pages",
  "layout.headerFooterContact",
  "sections.found",
  "sections.decorated",
  "sections.missing",
  "sections.summaryMissing",
  "sections.nonstandard",
  "contact.email",
  "contact.emailMissing",
  "contact.phone",
  "contact.phoneMissing",
  "contact.linkedin",
  "contact.linkedinHidden",
  "contact.linkedinMissing",
  "content.quantified",
  "content.quantifiedLow",
  "content.actionVerbs",
  "content.actionVerbsLow",
  "content.bullets",
  "content.bulletsMissing",
  "content.datesMissing",
  "content.pronouns",
  "keywords.match",
  "keywords.missing",
  "keywords.stuffing",
  "keywords.jobShort",
  "language.mismatch",
] as const;

export type FindingId = (typeof FINDING_IDS)[number];
export type FindingParams = Record<string, string | number>;

export interface Finding {
  id: FindingId;
  severity: Severity;
  category: Category;
  params?: FindingParams;
}

export interface KeywordHit {
  term: string;
  weight: number;
  isSkill: boolean;
}

export interface CategoryScore {
  score: number;
  weight: number;
}

export interface AnalysisInput {
  resumeText: string;
  jobText?: string;
  /** Text found only in page headers/footers (DOCX), which many ATS ignore. */
  headerFooterText?: string;
  layout?: Partial<LayoutSignals>;
  truncated?: boolean;
}

export interface AnalysisResult {
  score: number;
  categories: Record<Category, CategoryScore | null>;
  findings: Finding[];
  keywords: { matched: KeywordHit[]; missing: KeywordHit[] } | null;
  language: { resume: DetectedLang; job: DetectedLang | null };
  stats: { words: number; lines: number; bullets: number };
}
