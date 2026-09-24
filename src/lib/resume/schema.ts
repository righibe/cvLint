import { z } from "zod";
import { stripUnsafeChars } from "../text/normalize";
import { normalizeMonth } from "./format";

export const RESUME_SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 512 * 1024;

export const FIELD_LIMITS = {
  short: 60,
  medium: 120,
  long: 160,
  highlight: 400,
  description: 600,
  summary: 1500,
  url: 300,
} as const;

// Conservative charset on purpose: the value ends up in a mailto: href, where "?" or "&"
// would let a crafted address inject headers (cc, subject, body).
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}$/;

const clean = (s: string) => stripUnsafeChars(s).trim();

/**
 * Free text, trimmed to the field limit. Over-long values are cut, never rejected: one
 * long field must not make a whole saved resume unreadable. Total work stays bounded
 * because imports (512 KB) and stored data (1 MB) are size-checked before parsing.
 */
const text = (max: number) => z.string().transform((s) => clean(s.slice(0, max * 2)).slice(0, max));

/** Normalized to "YYYY-MM" or "YYYY"; unrecognizable dates become "". */
const month = z.string().transform((s) => normalizeMonth(s.slice(0, 40)));

/**
 * Only absolute http(s) URLs without credentials survive. Anything else
 * (javascript:, data:, vbscript:, relative paths) returns null.
 */
export function toSafeUrl(value: string): string | null {
  const trimmed = clean(value);
  if (trimmed === "" || trimmed.length > FIELD_LIMITS.url) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || !url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}

/** Stored as typed (the editor needs partial values); links are only built via toSafeUrl. */
const url = text(FIELD_LIMITS.url);
const email = text(254);

const list = <T extends z.ZodType>(item: T, max: number) => z.array(item).max(max);

export const LIST_LIMITS = {
  profiles: 6,
  work: 15,
  highlights: 12,
  education: 10,
  skills: 15,
  skillKeywords: 30,
  projects: 10,
  projectHighlights: 8,
  certificates: 15,
  languages: 10,
} as const;

export const profileSchema = z.object({ network: text(FIELD_LIMITS.short), url });

export const workSchema = z.object({
  company: text(FIELD_LIMITS.medium),
  position: text(FIELD_LIMITS.medium),
  location: text(FIELD_LIMITS.medium),
  startDate: month,
  endDate: month,
  current: z.boolean(),
  highlights: list(text(FIELD_LIMITS.highlight), LIST_LIMITS.highlights),
});

export const educationSchema = z.object({
  institution: text(FIELD_LIMITS.long),
  area: text(FIELD_LIMITS.long),
  studyType: text(FIELD_LIMITS.medium),
  startDate: month,
  endDate: month,
});

export const skillSchema = z.object({
  name: text(FIELD_LIMITS.short),
  keywords: list(text(FIELD_LIMITS.short), LIST_LIMITS.skillKeywords),
});
export const projectSchema = z.object({
  name: text(FIELD_LIMITS.medium),
  description: text(FIELD_LIMITS.description),
  url,
  highlights: list(text(FIELD_LIMITS.highlight), LIST_LIMITS.projectHighlights),
});
export const certificateSchema = z.object({
  name: text(FIELD_LIMITS.long),
  issuer: text(FIELD_LIMITS.medium),
  date: month,
  url,
});
export const languageSchema = z.object({ language: text(FIELD_LIMITS.short), fluency: text(FIELD_LIMITS.short) });

export const resumeSchema = z.object({
  version: z.literal(RESUME_SCHEMA_VERSION),
  meta: z.object({
    language: z.enum(["en", "pt"]),
    template: z.enum(["classic", "modern"]),
  }),
  basics: z.object({
    name: text(FIELD_LIMITS.medium),
    label: text(FIELD_LIMITS.medium),
    email,
    phone: text(40),
    location: text(FIELD_LIMITS.medium),
    url,
    summary: text(FIELD_LIMITS.summary),
    profiles: list(profileSchema, LIST_LIMITS.profiles),
  }),
  work: list(workSchema, LIST_LIMITS.work),
  education: list(educationSchema, LIST_LIMITS.education),
  skills: list(skillSchema, LIST_LIMITS.skills),
  projects: list(projectSchema, LIST_LIMITS.projects),
  certificates: list(certificateSchema, LIST_LIMITS.certificates),
  languages: list(languageSchema, LIST_LIMITS.languages),
});

export type ResumeData = z.output<typeof resumeSchema>;
export type WorkItem = ResumeData["work"][number];
export type EducationItem = ResumeData["education"][number];
export type SkillItem = ResumeData["skills"][number];
export type ProjectItem = ResumeData["projects"][number];
export type CertificateItem = ResumeData["certificates"][number];
export type LanguageItem = ResumeData["languages"][number];
export type ProfileItem = ResumeData["basics"]["profiles"][number];

export function emptyResume(language: "en" | "pt" = "en"): ResumeData {
  return {
    version: RESUME_SCHEMA_VERSION,
    meta: { language, template: "classic" },
    basics: { name: "", label: "", email: "", phone: "", location: "", url: "", summary: "", profiles: [] },
    work: [],
    education: [],
    skills: [],
    projects: [],
    certificates: [],
    languages: [],
  };
}

export const emptyWork = (): WorkItem => ({
  company: "",
  position: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  highlights: [""],
});
export const emptyEducation = (): EducationItem => ({ institution: "", area: "", studyType: "", startDate: "", endDate: "" });
export const emptySkill = (): SkillItem => ({ name: "", keywords: [] });
export const emptyProject = (): ProjectItem => ({ name: "", description: "", url: "", highlights: [] });
export const emptyCertificate = (): CertificateItem => ({ name: "", issuer: "", date: "", url: "" });
export const emptyLanguage = (): LanguageItem => ({ language: "", fluency: "" });
export const emptyProfile = (): ProfileItem => ({ network: "", url: "" });
