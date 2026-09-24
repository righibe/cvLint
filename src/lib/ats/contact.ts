export interface ContactReport {
  email: boolean;
  phone: boolean;
  /** "url" = profile URL visible as text; "label" = only the word "LinkedIn" (URL hidden in a link). */
  linkedin: "url" | "label" | "none";
}

// Every pattern below runs on a single whitespace-delimited token or a length-capped
// line, so worst-case regex cost is bounded regardless of document size.
const EMAIL = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){0,8}\.[a-z]{2,24}$/i;
const PHONE_CANDIDATE = /\+?\(?\d[\d\s().-]{6,18}\d/g;
/** Brazilian CPF (123.456.789-00) and CNPJ-like identifiers. */
const TAX_ID = /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{2}\.\d{3}\.\d{3}\/?\d{4}-\d{2}$/;
/** "01.2019 - 12.2022" / "01/2019 - 12/2022" date ranges. */
const MONTH_RANGE = /^\d{1,2}[./]\d{4}\s*[-–]\s*\d{1,2}[./]\d{4}$/;
const YEAR = /^(?:19|20)\d{2}$/;
const MAX_TOKEN = 320;
const MAX_LINE = 200;

function cleanToken(token: string): string {
  return token.replace(/^[<([{"'`]+|[>)\]}"'`,;:.!?]+$/g, "").replace(/^mailto:/i, "");
}

/**
 * A phone needs an international prefix, a parenthesized area code or at least 10
 * digits; postal codes (CEP), tax ids, IDs and year/month ranges are not phones.
 */
export function isPhoneCandidate(candidate: string): boolean {
  const trimmed = candidate.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return false;
  if (TAX_ID.test(trimmed) || MONTH_RANGE.test(trimmed)) return false;
  const groups = trimmed.match(/\d+/g) ?? [];
  if (groups.every((g) => YEAR.test(g))) return false;
  return trimmed.startsWith("+") || /\(\d{2,4}\)/.test(trimmed) || digits.length >= 10;
}

export function detectContact(text: string): ContactReport {
  let email = false;
  let phone = false;
  let linkedin: ContactReport["linkedin"] = "none";

  for (const raw of text.split(/\s+/)) {
    if (!raw || raw.length > MAX_TOKEN) continue;
    const token = cleanToken(raw);
    if (!email && EMAIL.test(token)) email = true;
    const lower = token.toLowerCase();
    if (lower.includes("linkedin.com/in/") || lower.includes("linkedin.com/pub/")) linkedin = "url";
    else if (linkedin === "none" && lower.replace(/[^a-z]/g, "") === "linkedin") linkedin = "label";
  }

  for (const line of text.split("\n")) {
    if (phone) break;
    for (const match of line.slice(0, MAX_LINE).matchAll(PHONE_CANDIDATE)) {
      if (isPhoneCandidate(match[0])) {
        phone = true;
        break;
      }
    }
  }

  return { email, phone, linkedin };
}
