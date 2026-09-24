import { fold } from "./normalize";

/** Slash compounds that are a single concept; other "a/b" tokens are split. */
const KEEP_SLASH = new Set(["ci/cd", "tcp/ip", "ui/ux", "pl/sql", "i/o", "b2b/b2c"]);

/**
 * Folds and splits text into tokens while keeping tech names intact:
 * "C++", "C#", "Node.js", ".NET" (-> "dotnet"), "CI/CD". Hyphens and apostrophes
 * separate words ("front-end" -> "front end", "2019-2024" -> "2019 2024"), so
 * compounds match however they are written. The token regex has no nested quantifiers.
 */
export function tokenize(text: string): string[] {
  const folded = fold(text)
    .replace(/(^|[^a-z0-9])\.net(?![a-z0-9])/g, "$1dotnet")
    .replace(/['’]s\b/g, "")
    .replace(/[-'’]/g, " ");
  const raw = folded.match(/[a-z0-9][a-z0-9+#./]*[a-z0-9+#]|[a-z0-9]/g) ?? [];
  const tokens: string[] = [];

  for (const token of raw) {
    if (token.includes("/") && !KEEP_SLASH.has(token)) {
      for (const part of token.split("/")) {
        const clean = part.replace(/\.+$/, "");
        if (clean) tokens.push(clean);
      }
    } else {
      tokens.push(token);
    }
  }
  return tokens;
}

/**
 * Light, conservative stemming shared by EN and PT so that plural and simple
 * verb forms compare equal ("features"/"feature", "designed"/"design",
 * "gestões"/"gestão"). Both sides of every comparison go through it.
 */
export function stem(token: string): string {
  if (token.length <= 3 || /[^a-z]/.test(token)) return token;
  let s = token;

  if (s.endsWith("oes") || s.endsWith("aes")) s = `${s.slice(0, -3)}ao`;
  else if (s.endsWith("ais")) s = `${s.slice(0, -3)}al`;
  else if (s.endsWith("eis") && s.length > 5) s = `${s.slice(0, -3)}el`;
  else if (s.endsWith("ies") && s.length > 4) s = `${s.slice(0, -3)}y`;
  else if (/(?:ss|sh|ch|x|z)es$/.test(s) || (/res$/.test(s) && s.length > 5)) s = s.slice(0, -2);
  else if (s.endsWith("s") && !s.endsWith("ss") && !s.endsWith("us") && !s.endsWith("is")) s = s.slice(0, -1);

  // English verb forms, only when a real stem remains ("spring", "string" stay intact).
  if (s.endsWith("ing") && s.length - 3 >= 4) s = s.slice(0, -3);
  else if (s.endsWith("ed") && s.length - 2 >= 4) s = s.slice(0, -2);

  if (s.endsWith("e") && s.length > 4) s = s.slice(0, -1);
  return s;
}

/** " a b c " form used for whole-phrase containment checks. */
export function padded(tokens: string[]): string {
  return ` ${tokens.join(" ")} `;
}

export function countPhrase(haystackPadded: string, phraseTokens: string[]): number {
  if (phraseTokens.length === 0) return 0;
  const needle = padded(phraseTokens);
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystackPadded.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length - 1;
  }
}
