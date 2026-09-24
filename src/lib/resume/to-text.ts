import { displayUrl, formatMonth, formatRange, RESUME_HEADINGS } from "./format";
import { toSafeUrl, type ResumeData } from "./schema";

const nonEmpty = (parts: (string | null | undefined)[]) => parts.filter((p): p is string => !!p && p.trim() !== "");

/** Plain-text rendering in the same order and wording as the printable template. */
export function resumeToText(resume: ResumeData): string {
  const lang = resume.meta.language;
  const h = RESUME_HEADINGS[lang];
  const { basics } = resume;
  const out: string[] = [];

  out.push(...nonEmpty([basics.name, basics.label]));
  const links = [basics.url, ...basics.profiles.map((p) => p.url)].map((u) => toSafeUrl(u)).filter(Boolean) as string[];
  const contact = nonEmpty([basics.email, basics.phone, basics.location, ...links.map(displayUrl)]);
  if (contact.length) out.push(contact.join(" | "));

  const section = (title: string, lines: string[]) => {
    if (lines.length === 0) return;
    out.push("", title, ...lines);
  };

  section(h.summary, nonEmpty([basics.summary]));

  section(
    h.experience,
    resume.work.flatMap((w) => [
      nonEmpty([w.position, w.company]).join(" — "),
      nonEmpty([w.location, formatRange(w.startDate, w.endDate, w.current, lang)]).join(" | "),
      ...nonEmpty(w.highlights).map((b) => `• ${b}`),
    ]).filter(Boolean),
  );

  section(
    h.education,
    resume.education.flatMap((e) => [
      nonEmpty([e.studyType, e.area]).join(", "),
      nonEmpty([e.institution, formatRange(e.startDate, e.endDate, false, lang)]).join(" | "),
    ]).filter(Boolean),
  );

  section(
    h.skills,
    resume.skills
      .filter((s) => s.name || s.keywords.length)
      .map((s) => (s.name ? `${s.name}: ${nonEmpty(s.keywords).join(", ")}` : nonEmpty(s.keywords).join(", "))),
  );

  section(
    h.projects,
    resume.projects.flatMap((p) => {
      const href = toSafeUrl(p.url);
      return [
        nonEmpty([p.name, href ? displayUrl(href) : ""]).join(" | "),
        ...nonEmpty([p.description]),
        ...nonEmpty(p.highlights).map((b) => `• ${b}`),
      ];
    }).filter(Boolean),
  );

  section(
    h.certificates,
    resume.certificates.map((c) => nonEmpty([c.name, c.issuer, formatMonth(c.date, lang)]).join(" | ")).filter(Boolean),
  );

  section(
    h.languages,
    resume.languages.map((l) => nonEmpty([l.language, l.fluency]).join(" — ")).filter(Boolean),
  );

  return out.join("\n").trim();
}
