import type { Category } from "./types";

export type Band = "excellent" | "good" | "fair" | "poor";

/** Human label bucket for a 0–100 score; shared by every place that shows a score. */
export function scoreBand(score: number): Band {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/** Display order of the score categories. */
export const CATEGORY_ORDER: Category[] = ["keywords", "parseability", "sections", "content", "contact"];
