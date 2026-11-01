import { fold } from "../text/normalize";

/** Personal data a resume does not need and that should not travel inside a PDF. */
export const PERSONAL_DATA_KINDS = ["taxId", "idCard", "birthDate", "age", "maritalStatus"] as const;
export type PersonalDataKind = (typeof PERSONAL_DATA_KINDS)[number];

// Every pattern runs on a folded, length-capped line, so the cost is bounded.
const MAX_LINE = 200;
/** Marital status words are only trusted on short "header" lines, never inside a sentence. */
const MAX_STATUS_LINE = 80;

const CPF_NUMBER = /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/;
const CPF_LABEL = /\bcpf\b/;
const RG_LABEL = /\brg\b[^a-z0-9]{0,6}\d/;
const BIRTH = /\b(?:data de nascimento|nascimento|nascid[oa] em|date of birth|birth date|birthdate|dob)\b/;
const AGE_LABEL = /\b(?:idade|age)\s?:\s?\d{2}\b/;
/** "Brasileiro | 27 anos | Solteiro": an age standing alone between separators, not "10 anos de experiência". */
const AGE_SEGMENT = /(?:^|[|,;·•–—-]\s?)\d{2} (?:anos|years old)\s?(?:$|[|,;·•–—-])/;
const MARITAL_LABEL = /\b(?:estado civil|marital status)\b/;
const MARITAL_WORD = /\b(?:solteir[oa]|casad[oa]|divorciad[oa]|viuv[oa])\b/;

/** Kinds of unnecessary personal data found, in a stable order. */
export function detectPersonalData(text: string): PersonalDataKind[] {
  const found = new Set<PersonalDataKind>();

  for (const raw of text.split("\n")) {
    if (found.size === PERSONAL_DATA_KINDS.length) break;
    const line = fold(raw.slice(0, MAX_LINE)).trim();
    if (line === "") continue;

    if (CPF_NUMBER.test(line) || CPF_LABEL.test(line)) found.add("taxId");
    if (RG_LABEL.test(line)) found.add("idCard");
    if (BIRTH.test(line)) found.add("birthDate");
    if (AGE_LABEL.test(line) || AGE_SEGMENT.test(line)) found.add("age");
    if (MARITAL_LABEL.test(line) || (line.length <= MAX_STATUS_LINE && MARITAL_WORD.test(line))) found.add("maritalStatus");
  }

  return PERSONAL_DATA_KINDS.filter((kind) => found.has(kind));
}
