import type { Lang } from "../ats/types";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const RESUME_HEADINGS: Record<
  Lang,
  {
    summary: string;
    experience: string;
    education: string;
    skills: string;
    projects: string;
    certificates: string;
    languages: string;
    present: string;
  }
> = {
  en: {
    summary: "Summary",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
    certificates: "Certifications",
    languages: "Languages",
    present: "Present",
  },
  pt: {
    summary: "Resumo",
    experience: "Experiência Profissional",
    education: "Formação Acadêmica",
    skills: "Habilidades",
    projects: "Projetos",
    certificates: "Certificações",
    languages: "Idiomas",
    present: "Atual",
  },
};

const MONTH_NAMES: Record<string, number> = {};
[
  ["jan", "january", "janeiro"],
  ["feb", "february", "fev", "fevereiro"],
  ["mar", "march", "marco"],
  ["apr", "april", "abr", "abril"],
  ["may", "mai", "maio"],
  ["jun", "june", "junho"],
  ["jul", "july", "julho"],
  ["aug", "august", "ago", "agosto"],
  ["sep", "sept", "september", "set", "setembro"],
  ["oct", "october", "out", "outubro"],
  ["nov", "november", "novembro"],
  ["dec", "december", "dez", "dezembro"],
].forEach((names, i) => names.forEach((n) => (MONTH_NAMES[n] = i + 1)));

const validYear = (y: number) => y >= 1950 && y <= 2099;
const pad = (m: number) => String(m).padStart(2, "0");

/**
 * Accepts what people actually type or import — "2021-03", "2021-03-15", "03/2021",
 * "3.2021", "Mar 2021", "março de 2021", "2021" — and returns "YYYY-MM", "YYYY" or ""
 * when the value is not a recognizable month/year.
 */
export function normalizeMonth(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .slice(0, 30);
  if (s === "") return "";

  let m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s);
  if (m) return validYear(+m[1]!) && +m[2]! >= 1 && +m[2]! <= 12 ? `${m[1]}-${pad(+m[2]!)}` : "";

  m = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(s);
  if (m) return validYear(+m[2]!) && +m[1]! >= 1 && +m[1]! <= 12 ? `${m[2]}-${pad(+m[1]!)}` : "";

  m = /^([a-z]{3,9})\.?\s*(?:de\s+|\/\s*)?(\d{4})$/.exec(s);
  if (m) {
    const month = Object.hasOwn(MONTH_NAMES, m[1]!) ? MONTH_NAMES[m[1]!] : undefined;
    return month && validYear(+m[2]!) ? `${m[2]}-${pad(month)}` : "";
  }

  m = /^(\d{4})$/.exec(s);
  if (m) return validYear(+m[1]!) ? m[1]! : "";
  return "";
}

/** "2021-03" -> "Mar 2021" (en) or "03/2021" (pt); "2021" -> "2021". Formats ATS parsers read reliably. */
export function formatMonth(value: string, lang: Lang): string {
  const normalized = normalizeMonth(value);
  const match = /^(\d{4})-(\d{2})$/.exec(normalized);
  if (!match) return normalized;
  const [, year, mm] = match;
  if (lang === "pt") return `${mm}/${year}`;
  return `${MONTHS_EN[Number(mm) - 1] ?? ""} ${year}`.trim();
}

export function formatRange(start: string, end: string, current: boolean, lang: Lang): string {
  const from = formatMonth(start, lang);
  const to = current ? RESUME_HEADINGS[lang].present : formatMonth(end, lang);
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

/** Display form of a URL without the protocol noise: "https://github.com/x/" -> "github.com/x". */
export function displayUrl(href: string): string {
  return href.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
