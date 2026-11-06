import { countPhrase, padded, stem, tokenize } from "../text/tokenize";
import { ACTION_VERBS, WEAK_PHRASES } from "./lexicon";

export interface ContentReport {
  words: number;
  lines: number;
  bullets: number;
  quantified: number;
  actionVerbs: number;
  years: number;
  firstPerson: number;
  garbled: number;
  /** Duty/trait wording ("responsible for", "proativo"), most frequent first. */
  weakPhrases: { phrase: string; count: number }[];
  /** Bullets longer than MAX_BULLET_WORDS words. */
  longBullets: number;
  /** The action verb that opens the most lines ("developed" also counts "develop"). */
  topVerb: { verb: string; count: number } | null;
}

/** Past this many words a bullet stops being scannable. */
export const MAX_BULLET_WORDS = 35;

const WEAK = WEAK_PHRASES.map((phrase) => ({ phrase, tokens: tokenize(phrase) }));

const BULLET = /^[•·▪▫●○◦‣⁃∙■□►▸➢➤✓✔*\-–—]\s*/;
/** "Action: built…", "Resultado: reduzi…" (STAR-style labels before the verb). */
const LEAD_LABEL = /^[\p{L}]{2,20}(?:\s[\p{L}]{2,20})?:\s+/u;
const YEAR = /^(?:19[5-9]\d|20[0-4]\d)$/;
const METRIC = /\d\s?(?:%|x\b|k\b|\+)|[$€£]\s?\d|r\$\s?\d/i;
// Private Use Area (icon fonts), replacement char and "(cid:NN)" placeholders all mean
// the PDF font has no usable text mapping: an ATS sees garbage instead of the glyph.
const GARBLED = /[-�]|\(cid:\d{1,5}\)/g;
// Icon fonts mapped onto ordinary code points show up as lone characters ("§ github.com",
// "ï linkedin.com"). Single-character tokens that are neither ASCII alphanumerics nor
// common separators or one-letter Portuguese words are counted as stray glyphs.
const SINGLE_CHAR_TOKEN = /(?:^|\s)(\S)(?=\s|$)/gm;
const ALLOWED_SINGLE = new Set([..."|•·–—-/&+@→←*,;:()\"'▪●◦‣∙►▸✓✔%$€£.àÀéÉóÓ"]);

function strayGlyphs(text: string): number {
  let count = 0;
  for (const match of text.matchAll(SINGLE_CHAR_TOKEN)) {
    const ch = match[1]!;
    // PUA/replacement characters are already counted by GARBLED.
    if (!/[A-Za-z0-9-�]/.test(ch) && !ALLOWED_SINGLE.has(ch)) count += 1;
  }
  return count;
}

function isQuantified(body: string, tokens: string[]): boolean {
  if (tokens.length < 4) return false;
  if (METRIC.test(body)) return true;
  return tokens.some((t) => /^\d{2,}$/.test(t) && !YEAR.test(t));
}

export function analyzeContent(text: string): ContentReport {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  let bullets = 0;
  let quantified = 0;
  let actionVerbs = 0;
  let longBullets = 0;
  const verbUse = new Map<string, { verb: string; count: number }>();

  for (const line of lines) {
    const trimmed = line.trim();
    const isBullet = BULLET.test(trimmed);
    if (isBullet) bullets += 1;
    const body = trimmed.replace(BULLET, "").slice(0, 400);
    const tokens = tokenize(body);
    if (isBullet && tokens.length > MAX_BULLET_WORDS) longBullets += 1;
    if (isQuantified(body, tokens)) quantified += 1;
    const verbTokens = tokenize(body.replace(LEAD_LABEL, ""));
    // "Co-founded", "co-led": the hyphen splits off "co".
    if (verbTokens[0] === "co") verbTokens.shift();
    const first = verbTokens[0];
    if (first && verbTokens.length >= 3 && ACTION_VERBS.has(first)) {
      actionVerbs += 1;
      const use = verbUse.get(stem(first)) ?? { verb: first, count: 0 };
      use.count += 1;
      verbUse.set(stem(first), use);
    }
  }

  const tokens = tokenize(text);
  const paddedTokens = padded(tokens);
  const weakPhrases = WEAK.map((w) => ({ phrase: w.phrase, count: countPhrase(paddedTokens, w.tokens) }))
    .filter((w) => w.count > 0)
    .sort((a, b) => b.count - a.count);

  let topVerb: ContentReport["topVerb"] = null;
  for (const use of verbUse.values()) if (!topVerb || use.count > topVerb.count) topVerb = use;

  return {
    words: tokens.length,
    lines: lines.length,
    bullets,
    quantified,
    actionVerbs,
    years: tokens.filter((t) => YEAR.test(t)).length,
    firstPerson: tokens.filter((t) => t === "i" || t === "my" || t === "me" || t === "myself").length,
    garbled: (text.match(GARBLED) ?? []).length + strayGlyphs(text),
    weakPhrases,
    longBullets,
    topVerb,
  };
}
