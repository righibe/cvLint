import { fold } from "../text/normalize";
import { countPhrase, padded, stem, tokenize } from "../text/tokenize";
import {
  JOB_NOISE,
  NEUTRAL_HEADINGS,
  NICE_TO_HAVE_HEADINGS,
  NON_REQUIREMENT_HEADINGS,
  REQUIREMENT_HEADINGS,
  SKILLS,
  STOPWORDS_EN,
  STOPWORDS_PT,
  type SkillDef,
} from "./lexicon";
import type { KeywordHit } from "./types";

interface CompiledSkill {
  def: SkillDef;
  aliasTokens: string[][];
  labelPattern: RegExp | null;
  /** Words that, right after the bare label, turn it into a different, longer skill ("Spring" + "Boot"). */
  blockedNext: Set<string>;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LINE_START = "^[ \\t•·▪●◦‣*–—-]*";

/**
 * Exact-case bare label, as a whole word, never glued to a hyphen ("Go-to-market",
 * "C-level"), and not the first word of a sentence or bullet ("Go above and beyond",
 * "• Excel in…") unless it is clearly a list item ("• Spark, Kafka").
 */
function labelPattern(def: SkillDef): RegExp | null {
  if (!def.caseSensitive) return null;
  if (def.labelRegex) return new RegExp(def.labelRegex, "gm");
  const label = escapeRegExp(def.label);
  return new RegExp(
    `(?<![\\w.#+-])(?:(?<![.!?]\\s{1,3})(?<!${LINE_START})${label}|(?<=${LINE_START})${label}(?=\\s*[,/|;]))(?![\\w#+-])`,
    "gm",
  );
}

const COMPILED_SKILLS: CompiledSkill[] = SKILLS.map((def) => ({
  def,
  aliasTokens: def.aliases.map(tokenize).filter((t) => t.length > 0),
  labelPattern: labelPattern(def),
  blockedNext: new Set<string>(),
}));

for (const skill of COMPILED_SKILLS.filter((s) => s.def.caseSensitive)) {
  const [labelToken] = tokenize(skill.def.label);
  for (const other of COMPILED_SKILLS) {
    if (other === skill) continue;
    for (const alias of other.aliasTokens) {
      if (alias.length >= 2 && alias[0] === labelToken) skill.blockedNext.add(alias[1]!);
    }
  }
}

/** Alias lists keyed by first token, longest first, for leftmost-longest scanning. */
const ALIASES_BY_FIRST = new Map<string, { skill: CompiledSkill; tokens: string[] }[]>();
for (const skill of COMPILED_SKILLS) {
  for (const tokens of skill.aliasTokens) {
    const list = ALIASES_BY_FIRST.get(tokens[0]!) ?? [];
    list.push({ skill, tokens });
    ALIASES_BY_FIRST.set(tokens[0]!, list);
  }
}
for (const list of ALIASES_BY_FIRST.values()) list.sort((a, b) => b.tokens.length - a.tokens.length);

/** Everyday words that double as skill names ("excel", "solid") never become generic terms. */
const AMBIGUOUS_TOKENS = new Set(COMPILED_SKILLS.filter((s) => s.def.caseSensitive).flatMap((s) => tokenize(s.def.label)));

interface SkillScan {
  counts: Map<CompiledSkill, number>;
  /** Token positions that belong to a recognized skill phrase. */
  covered: Uint8Array;
}

/**
 * Leftmost-longest matching: "React Native" is one skill, not also "React";
 * "SQL Server" is not "SQL"; "Spring Boot" is not also "Spring".
 */
function scanSkills(tokens: string[], original: string): SkillScan {
  const counts = new Map<CompiledSkill, number>();
  const covered = new Uint8Array(tokens.length);
  const bump = (skill: CompiledSkill) => counts.set(skill, (counts.get(skill) ?? 0) + 1);

  for (let i = 0; i < tokens.length; ) {
    const candidates = ALIASES_BY_FIRST.get(tokens[i]!);
    const match = candidates?.find((c) => c.tokens.every((t, k) => tokens[i + k] === t));
    if (match) {
      bump(match.skill);
      covered.fill(1, i, i + match.tokens.length);
      i += match.tokens.length;
    } else {
      i += 1;
    }
  }

  for (const skill of COMPILED_SKILLS) {
    if (!skill.labelPattern) continue;
    for (const m of original.matchAll(skill.labelPattern)) {
      const next = tokenize(original.slice(m.index + m[0].length, m.index + m[0].length + 40))[0];
      if (next && skill.blockedNext.has(next)) continue;
      bump(skill);
    }
  }
  return { counts, covered };
}

export interface TextIndex {
  original: string;
  tokens: string[];
  stems: string[];
  paddedStems: string;
  stemCounts: Map<string, number>;
  skills: Map<CompiledSkill, number>;
}

export function indexText(text: string): TextIndex {
  const tokens = tokenize(text);
  const stems = tokens.map(stem);
  const stemCounts = new Map<string, number>();
  for (const s of stems) stemCounts.set(s, (stemCounts.get(s) ?? 0) + 1);
  return { original: text, tokens, stems, paddedStems: padded(stems), stemCounts, skills: scanSkills(tokens, text).counts };
}

function isCandidateToken(token: string): boolean {
  return (
    token.length >= 3 &&
    !/^\d+([.,]\d+)?$/.test(token) &&
    !STOPWORDS_EN.has(token) &&
    !STOPWORDS_PT.has(token) &&
    !JOB_NOISE.has(token) &&
    !AMBIGUOUS_TOKENS.has(token)
  );
}

type SkillKeyword = { kind: "skill"; term: string; weight: number; skill: CompiledSkill };
type TermKeyword = { kind: "term"; term: string; weight: number; stems: string[] };
export type JobKeyword = SkillKeyword | TermKeyword;

/**
 * Weighs job-ad lines by the section they sit in: requirements 1.5, nice-to-have 0.75,
 * benefits / company blurb 0 (ignored), everything else 1.
 */
export function lineWeights(lines: string[]): number[] {
  let weight = 1;
  return lines.map((line) => {
    const key = fold(line).trim();
    if (key.length <= 60) {
      if (NON_REQUIREMENT_HEADINGS.test(key)) weight = 0;
      else if (NICE_TO_HAVE_HEADINGS.test(key)) weight = 0.75;
      else if (REQUIREMENT_HEADINGS.test(key)) weight = 1.5;
      else if (NEUTRAL_HEADINGS.test(key)) weight = 1;
    }
    return weight;
  });
}

export const MAX_SKILLS = 20;
export const MAX_TERMS = 12;

export function extractJobKeywords(jobText: string): JobKeyword[] {
  const lines = jobText.split("\n");
  const weights = lineWeights(lines);

  const skillStats = new Map<CompiledSkill, { count: number; weight: number }>();
  const termScores = new Map<string, { score: number; count: number; display: Map<string, number>; stems: string[]; maxWeight: number }>();
  const bump = (key: string, stems: string[], display: string, w: number) => {
    const entry = termScores.get(key) ?? { score: 0, count: 0, display: new Map(), stems, maxWeight: 0 };
    entry.score += w;
    entry.count += 1;
    entry.maxWeight = Math.max(entry.maxWeight, w);
    entry.display.set(display, (entry.display.get(display) ?? 0) + 1);
    termScores.set(key, entry);
  };

  lines.forEach((line, i) => {
    const w = weights[i] ?? 1;
    if (w === 0) return;
    const tokens = tokenize(line);
    const { counts, covered } = scanSkills(tokens, line);
    for (const [skill, count] of counts) {
      const stat = skillStats.get(skill) ?? { count: 0, weight: 0 };
      stat.count += count;
      stat.weight = Math.max(stat.weight, w);
      skillStats.set(skill, stat);
    }

    // Generic terms: unigrams and bigrams of meaningful words outside skill phrases.
    const usable = (t: number) => covered[t] === 0 && isCandidateToken(tokens[t]!);
    for (let t = 0; t < tokens.length; t += 1) {
      if (!usable(t)) continue;
      const token = tokens[t]!;
      bump(stem(token), [stem(token)], token, w);
      if (t + 1 < tokens.length && usable(t + 1)) {
        const next = tokens[t + 1]!;
        bump(`${stem(token)} ${stem(next)}`, [stem(token), stem(next)], `${token} ${next}`, w * 1.5);
      }
    }
  });

  const skills: SkillKeyword[] = [...skillStats.entries()]
    .map(([skill, stat]) => {
      const base = (skill.def.soft ? 1.5 : 3) * (stat.weight >= 1.5 ? 1.2 : stat.weight < 1 ? 0.8 : 1);
      return { kind: "skill" as const, term: skill.def.label, weight: base + Math.min(stat.count - 1, 3) * 0.5, skill };
    })
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
    .slice(0, MAX_SKILLS);

  // Repeated terms, or single mentions under an explicit requirements heading.
  const terms: TermKeyword[] = [...termScores.values()]
    .filter((e) => e.count >= 2 || (e.maxWeight >= 1.5 && e.stems.length === 1 && (e.stems[0]?.length ?? 0) >= 4))
    .map((e) => {
      const display = [...e.display.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? e.stems.join(" ");
      return { kind: "term" as const, term: display, weight: Math.min(e.score, 4), stems: e.stems };
    })
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));

  // A bigram that made the cut makes its component unigrams redundant.
  const chosenTerms: TermKeyword[] = [];
  const covered = new Set<string>();
  for (const term of terms.filter((t) => t.stems.length === 2)) {
    if (chosenTerms.length >= MAX_TERMS / 2) break;
    chosenTerms.push(term);
    term.stems.forEach((s) => covered.add(s));
  }
  for (const term of terms.filter((t) => t.stems.length === 1)) {
    if (chosenTerms.length >= MAX_TERMS) break;
    if (!covered.has(term.stems[0]!)) chosenTerms.push(term);
  }

  return [...skills, ...chosenTerms];
}

export interface KeywordMatch {
  matched: KeywordHit[];
  missing: KeywordHit[];
  score: number;
  stuffed: { term: string; count: number }[];
}

export const STUFFING_PENALTY = 10;

export function matchKeywords(keywords: JobKeyword[], resume: TextIndex): KeywordMatch {
  const matched: KeywordHit[] = [];
  const missing: KeywordHit[] = [];
  const stuffed: KeywordMatch["stuffed"] = [];
  let total = 0;
  let hit = 0;

  for (const keyword of keywords) {
    const count =
      keyword.kind === "skill"
        ? (resume.skills.get(keyword.skill) ?? 0)
        : keyword.stems.length === 1
          ? (resume.stemCounts.get(keyword.stems[0]!) ?? 0)
          : countPhrase(resume.paddedStems, keyword.stems);

    const entry: KeywordHit = { term: keyword.term, weight: keyword.weight, isSkill: keyword.kind === "skill" };
    total += keyword.weight;
    if (count > 0) {
      matched.push(entry);
      // A stuffed keyword is shown as found but earns no credit (and costs a penalty below).
      if (count >= 10 && count / Math.max(resume.tokens.length, 1) > 0.03) stuffed.push({ term: keyword.term, count });
      else hit += keyword.weight;
    } else {
      missing.push(entry);
    }
  }

  const byWeight = (a: KeywordHit, b: KeywordHit) => b.weight - a.weight;
  const raw = total === 0 ? 0 : (hit / total) * 100;
  // Repeating a keyword to game the match must never raise the score.
  const penalty = Math.min(stuffed.length * STUFFING_PENALTY, 30);
  return {
    matched: matched.sort(byWeight),
    missing: missing.sort(byWeight),
    score: Math.max(0, Math.round(raw - penalty)),
    stuffed,
  };
}
