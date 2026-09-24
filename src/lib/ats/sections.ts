import { fold } from "../text/normalize";
import { NONSTANDARD_HEADINGS, SECTION_SYNONYMS, type SectionId } from "./lexicon";

export interface SectionReport {
  found: SectionId[];
  /** Found only after dropping a stray leading glyph (icon fonts: "l EXPERIENCE", "Ô SKILLS"). */
  decorated: { heading: string; section: SectionId }[];
  nonstandard: { heading: string; suggestion: SectionId }[];
}

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

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const isBullet = BULLET_START.test(trimmed);

    // Inline headings: "Skills: Python, SQL", "Idiomas: Inglês".
    const colon = trimmed.indexOf(":");
    const candidates = [trimmed, ...(colon > 0 && colon <= 40 ? [trimmed.slice(0, colon)] : [])];
    let matched = false;

    for (const candidate of candidates) {
      const key = headingKey(candidate);
      if (!key) continue;

      const ids = sectionsOf(key, isBullet);
      if (ids.length > 0) {
        ids.forEach((id) => found.add(id));
        matched = true;
        break;
      }

      // A single stray character before the heading is almost always an icon glyph.
      const stripped = /^\S (.+)$/.exec(key)?.[1];
      const decoratedIds = stripped ? sectionsOf(stripped, isBullet) : [];
      if (decoratedIds.length > 0) {
        decoratedIds.forEach((section) => decorated.push({ heading: trimmed, section }));
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const key = headingKey(trimmed);
    // Own keys only: a heading such as "Constructor" must not resolve to Object.prototype members.
    const suggestion = key && Object.hasOwn(NONSTANDARD_HEADINGS, key) ? NONSTANDARD_HEADINGS[key] : undefined;
    if (suggestion && !nonstandard.some((n) => n.suggestion === suggestion)) {
      nonstandard.push({ heading: trimmed, suggestion });
    }
  }

  return {
    found: SECTION_IDS.filter((id) => found.has(id)),
    decorated: decorated.filter((d, i) => !found.has(d.section) && decorated.findIndex((x) => x.section === d.section) === i),
    nonstandard: nonstandard.filter((n) => !found.has(n.suggestion)),
  };
}
