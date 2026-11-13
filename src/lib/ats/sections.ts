import { fold } from "../text/normalize";
import { NONSTANDARD_HEADINGS, SECTION_SYNONYMS, type SectionId } from "./lexicon";

export interface SectionReport {
  found: SectionId[];
  /** Found only after dropping a stray leading glyph (icon fonts: "l EXPERIENCE", "Ô SKILLS"). */
  decorated: { heading: string; section: SectionId }[];
  nonstandard: { heading: string; suggestion: SectionId }[];
  /** Recognized headings with no text before the next heading. */
  empty: SectionId[];
  /** Lines [start, end) of the text filed under each recognized heading. */
  spans: { section: SectionId; start: number; end: number }[];
}

interface HeadingLine {
  line: number;
  sections: SectionId[];
  /** "Skills: Python, SQL": the content sits on the heading line itself. */
  inline: boolean;
}

const HAS_TEXT = /[\p{L}\p{N}]/u;

const SECTION_IDS = Object.keys(SECTION_SYNONYMS) as SectionId[];
/** Bullet lines are headings only when they are exactly a heading ("— Skills —", not "• Projects delivered"). */
const BULLET_START = /^[•·▪▫●○◦‣⁃∙■□►▸➢➤✓✔*\-–—]/;

/** Strips numbering/icons and trailing punctuation around a heading candidate. */
function headingKey(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 48) return null;
  const key = fold(trimmed)
    .replace(/^[^a-z]+/, "")
    .replace(/[\s:.\-–—|]+$/, "")
    .replace(/\s+/g, " ");
  if (!key || key.split(" ").length > 5) return null;
  return key;
}

function matchSynonym(key: string, exactOnly: boolean): SectionId | undefined {
  return SECTION_IDS.find((id) =>
    SECTION_SYNONYMS[id].some((syn) => {
      if (key === syn) return true;
      if (exactOnly) return false;
      // "skills & tools", "experiencia profissional e projetos": a short tail is allowed.
      return key.startsWith(`${syn} `) && key.slice(syn.length).trim().split(" ").length <= 2;
    }),
  );
}

/** "Education & Certifications" credits both sections. */
function sectionsOf(key: string, exactOnly = false): SectionId[] {
  const parts = key.split(/\s*(?:&|\/|,|\+|\band\b|\be\b)\s*/).filter(Boolean);
  if (parts.length > 1) {
    const ids = parts
      .map((p) => SECTION_IDS.find((id) => SECTION_SYNONYMS[id].includes(p)))
      .filter((id): id is SectionId => id !== undefined);
    if (ids.length > 0) return [...new Set(ids)];
  }
  const single = matchSynonym(key, exactOnly);
  return single ? [single] : [];
}

export function detectSections(text: string): SectionReport {
  const found = new Set<SectionId>();
  const decorated: SectionReport["decorated"] = [];
  const nonstandard: SectionReport["nonstandard"] = [];

  const lines = text.split("\n");
  const headings: HeadingLine[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const isBullet = BULLET_START.test(trimmed);

    // Inline headings: "Skills: Python, SQL", "Idiomas: Inglês".
    const colon = trimmed.indexOf(":");
    const candidates = [trimmed, ...(colon > 0 && colon <= 40 ? [trimmed.slice(0, colon)] : [])];
    let matched = false;

    for (const candidate of candidates) {
      const key = headingKey(candidate);
      if (!key) continue;

      const inline = candidate !== trimmed && HAS_TEXT.test(trimmed.slice(candidate.length));
      const ids = sectionsOf(key, isBullet);
      if (ids.length > 0) {
        ids.forEach((id) => found.add(id));
        headings.push({ line: index, sections: ids, inline });
        matched = true;
        break;
      }

      // A single stray character before the heading is almost always an icon glyph.
      const stripped = /^\S (.+)$/.exec(key)?.[1];
      const decoratedIds = stripped ? sectionsOf(stripped, isBullet) : [];
      if (decoratedIds.length > 0) {
        decoratedIds.forEach((section) => decorated.push({ heading: trimmed, section }));
        headings.push({ line: index, sections: decoratedIds, inline });
        matched = true;
        break;
      }
    }
    if (matched) return;

    const key = headingKey(trimmed);
    // Own keys only: a heading such as "Constructor" must not resolve to Object.prototype members.
    const suggestion = key && Object.hasOwn(NONSTANDARD_HEADINGS, key) ? NONSTANDARD_HEADINGS[key] : undefined;
    if (suggestion) {
      // A creative heading still ends the section above it.
      headings.push({ line: index, sections: [], inline: false });
      if (!nonstandard.some((n) => n.suggestion === suggestion)) nonstandard.push({ heading: trimmed, suggestion });
    }
  });

  // Text belongs to the last standalone heading above it. Inline headings ("Languages: English")
  // keep their own line and do not close the section they sit in.
  const blocks = headings.filter((h) => !h.inline);
  const spans: SectionReport["spans"] = [];
  const withText = new Set<SectionId>();
  for (const heading of headings) {
    const next = blocks.find((b) => b.line > heading.line);
    const start = heading.inline ? heading.line : heading.line + 1;
    const end = heading.inline ? heading.line + 1 : (next?.line ?? lines.length);
    const hasText = heading.inline || lines.slice(start, end).some((l) => HAS_TEXT.test(l));
    for (const section of heading.sections) {
      spans.push({ section, start, end });
      if (hasText) withText.add(section);
    }
  }

  return {
    found: SECTION_IDS.filter((id) => found.has(id)),
    decorated: decorated.filter((d, i) => !found.has(d.section) && decorated.findIndex((x) => x.section === d.section) === i),
    nonstandard: nonstandard.filter((n) => !found.has(n.suggestion)),
    empty: SECTION_IDS.filter((id) => spans.some((s) => s.section === id) && !withText.has(id)),
    spans,
  };
}
