import { tokenize } from "../text/tokenize";
import { STOPWORDS_EN, STOPWORDS_PT } from "./lexicon";
import type { DetectedLang } from "./types";

const SHARED = new Set(["a", "as", "me", "no", "for", "so", "ha"]);

export function detectLanguage(text: string): DetectedLang {
  let en = 0;
  let pt = 0;
  for (const token of tokenize(text.slice(0, 20_000))) {
    if (SHARED.has(token)) continue;
    if (STOPWORDS_EN.has(token)) en += 1;
    if (STOPWORDS_PT.has(token)) pt += 1;
  }
  // Portuguese-only letters are a strong hint even in keyword-heavy resumes.
  pt += Math.min(20, (text.slice(0, 20_000).match(/[ãõçÃÕÇ]/g) ?? []).length);

  if (en + pt < 5) return "unknown";
  if (pt > en * 1.2) return "pt";
  if (en > pt * 1.2) return "en";
  return "unknown";
}
