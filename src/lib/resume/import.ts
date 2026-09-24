import type { Lang } from "../ats/types";
import { normalizeMonth } from "./format";
import { LIST_LIMITS, MAX_IMPORT_BYTES, RESUME_SCHEMA_VERSION, resumeSchema, type ResumeData } from "./schema";

export type ImportError = "too_large" | "invalid_json" | "invalid_schema";
export type ImportResult = { ok: true; data: ResumeData } | { ok: false; error: ImportError };

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

type Obj = Record<string, unknown>;

/** JSON.parse that drops prototype-pollution keys at every depth. */
export function safeJsonParse(raw: string): unknown {
  return JSON.parse(raw, (key, value: unknown) => (FORBIDDEN_KEYS.has(key) ? undefined : value));
}

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const strs = (v: unknown, max: number): string[] => arr(v, max).map(str).filter(Boolean);

/** JSON Resume dates are "YYYY-MM-DD", "YYYY-MM" or "YYYY". */
const toMonth = (v: unknown): string => normalizeMonth(str(v).slice(0, 40));

/** Maps the community JSON Resume format (jsonresume.org) onto cvlint's schema. */
export function fromJsonResume(input: Obj, lang: Lang): unknown {
  const basics = isObj(input.basics) ? input.basics : {};
  const location = isObj(basics.location) ? basics.location : {};

  return {
    version: RESUME_SCHEMA_VERSION,
    meta: { language: lang, template: "classic" },
    basics: {
      name: str(basics.name),
      label: str(basics.label),
      email: str(basics.email),
      phone: str(basics.phone),
      location: [location.city, location.region, location.countryCode].map(str).filter(Boolean).join(", "),
      url: str(basics.url ?? basics.website),
      summary: str(basics.summary),
      profiles: arr(basics.profiles, LIST_LIMITS.profiles)
        .filter(isObj)
        .map((p) => ({ network: str(p.network), url: str(p.url) })),
    },
    work: arr(input.work, LIST_LIMITS.work)
      .filter(isObj)
      .map((w) => {
        const highlights = strs(w.highlights, LIST_LIMITS.highlights);
        const summary = str(w.summary);
        return {
          company: str(w.name ?? w.company),
          position: str(w.position),
          location: str(w.location),
          startDate: toMonth(w.startDate),
          endDate: toMonth(w.endDate),
          current: !w.endDate,
          highlights: highlights.length ? highlights : summary ? [summary] : [],
        };
      }),
    education: arr(input.education, LIST_LIMITS.education)
      .filter(isObj)
      .map((e) => ({
        institution: str(e.institution),
        area: str(e.area),
        studyType: str(e.studyType),
        startDate: toMonth(e.startDate),
        endDate: toMonth(e.endDate),
      })),
    skills: arr(input.skills, LIST_LIMITS.skills)
      .filter(isObj)
      .map((s) => ({ name: str(s.name), keywords: strs(s.keywords, LIST_LIMITS.skillKeywords) })),
    projects: arr(input.projects, LIST_LIMITS.projects)
      .filter(isObj)
      .map((p) => ({
        name: str(p.name),
        description: str(p.description),
        url: str(p.url),
        highlights: strs(p.highlights, LIST_LIMITS.projectHighlights),
      })),
    certificates: arr(input.certificates, LIST_LIMITS.certificates)
      .filter(isObj)
      .map((c) => ({ name: str(c.name), issuer: str(c.issuer), date: toMonth(c.date), url: str(c.url) })),
    languages: arr(input.languages, LIST_LIMITS.languages)
      .filter(isObj)
      .map((l) => ({ language: str(l.language), fluency: str(l.fluency) })),
  };
}

export function importResumeJson(raw: string, fallbackLang: Lang): ImportResult {
  if (raw.length > MAX_IMPORT_BYTES) return { ok: false, error: "too_large" };

  let parsed: unknown;
  try {
    parsed = safeJsonParse(raw);
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  if (!isObj(parsed)) return { ok: false, error: "invalid_schema" };

  const candidate = parsed.version === RESUME_SCHEMA_VERSION ? parsed : isObj(parsed.basics) ? fromJsonResume(parsed, fallbackLang) : null;
  if (candidate === null) return { ok: false, error: "invalid_schema" };

  const result = resumeSchema.safeParse(candidate);
  return result.success ? { ok: true, data: result.data } : { ok: false, error: "invalid_schema" };
}
