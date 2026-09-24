export const MAX_TEXT_CHARS = 60_000;

// C0/C1 control characters except \t and \n, plus bidi overrides/isolates that can
// visually reorder text (Trojan Source style spoofing), zero-width chars and BOM.
const UNSAFE_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function stripUnsafeChars(input: string): string {
  return input.replace(UNSAFE_CHARS, "");
}

/** Normalizes extracted document text into clean, bounded, line-oriented text. */
export function normalizeText(input: string, maxChars = MAX_TEXT_CHARS): { text: string; truncated: boolean } {
  // Cut before NFKC: some code points expand up to 18x, so normalizing unbounded input
  // could freeze the tab. Whitespace collapsing below only shrinks the text.
  const bounded = input.length > maxChars * 2 ? input.slice(0, maxChars * 2) : input;
  let text = bounded.normalize("NFKC").replace(/\r\n?/g, "\n");
  text = stripUnsafeChars(text).replace(/[  -   　]/g, " ");

  const lines = text.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim());
  text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (text.length > maxChars) {
    return { text: text.slice(0, maxChars), truncated: true };
  }
  return { text, truncated: bounded !== input };
}

/** Lowercase and strip diacritics so "Gestão" and "gestao" compare equal. */
export function fold(input: string): string {
  return input.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}
