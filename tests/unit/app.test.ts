import { describe, expect, it } from "vitest";
import { formatFinding } from "@/components/checker/format-finding";
import { isLocale, negotiateLocale } from "@/i18n/config";
import { en } from "@/i18n/dictionaries/en";
import { pt } from "@/i18n/dictionaries/pt";
import { getDictionary } from "@/i18n/get-dictionary";
import { scoreBand } from "@/lib/ats/band";
import { FINDING_IDS } from "@/lib/ats/types";
import { PARSE_ERROR_CODES } from "@/lib/parser/errors";
import { buildCsp, createNonce } from "@/lib/security/csp";

/** [path, value] for every leaf; keys may contain dots ("text.empty"), so paths are arrays. */
function leaves(value: unknown, path: string[] = []): [string[], unknown][] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, [...path, String(i)]));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k]));
  return [[path, value]];
}

const leafPaths = (value: unknown) => leaves(value).map(([p]) => JSON.stringify(p));

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n", () => {
  it("negotiates the locale from Accept-Language", () => {
    expect(negotiateLocale("pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt");
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("fr-FR,fr;q=0.9,pt;q=0.5")).toBe("pt");
    expect(negotiateLocale("en;q=0.2, pt;q=0.8")).toBe("pt");
    expect(negotiateLocale("pt;q=0, en")).toBe("en");
    expect(negotiateLocale("de")).toBe("en");
    expect(negotiateLocale("")).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("x".repeat(100_000))).toBe("en");
  });

  it("validates locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pt")).toBe(true);
    expect(isLocale("pt-BR")).toBe(false);
    expect(isLocale("__proto__")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("has the same keys in every dictionary, with no empty strings", () => {
    expect(leafPaths(pt).sort()).toEqual(leafPaths(en).sort());
    for (const dict of [en, pt]) {
      for (const [path, value] of leaves(dict)) {
        expect(typeof value === "string" && value.trim().length > 0, path.join(".")).toBe(true);
      }
    }
  });

  it("uses the same placeholders in every translation", () => {
    for (const id of FINDING_IDS) expect(placeholders(pt.findings[id]), id).toEqual(placeholders(en.findings[id]));
  });

  it("covers every finding and error code", () => {
    for (const id of FINDING_IDS) expect(en.findings[id]).toBeTruthy();
    for (const code of PARSE_ERROR_CODES) expect(pt.errors[code]).toBeTruthy();
    expect(getDictionary("pt")).toBe(pt);
  });
});

describe("formatFinding", () => {
  it("interpolates and localizes parameters", () => {
    expect(formatFinding({ id: "sections.missing", severity: "warning", category: "sections", params: { section: "experience" } }, pt)).toContain(
      "Experiência Profissional",
    );
    expect(
      formatFinding({ id: "sections.found", severity: "pass", category: "sections", params: { sections: "summary,skills" } }, en),
    ).toBe("Standard sections recognized: Summary, Skills.");
    expect(formatFinding({ id: "language.mismatch", severity: "warning", category: "keywords", params: { resume: "pt", job: "en" } }, pt)).toContain(
      "português",
    );
  });

  it("treats user-controlled parameters as plain text", () => {
    const text = formatFinding(
      { id: "sections.nonstandard", severity: "info", category: "sections", params: { heading: "$& <img src=x onerror=alert(1)>", suggestion: "__proto__" } },
      en,
    );
    expect(text).toContain("$& <img src=x onerror=alert(1)>");
    expect(text).toContain("“__proto__”");
  });

  it("leaves missing parameters empty", () => {
    expect(formatFinding({ id: "text.short", severity: "warning", category: "parseability" }, en)).toContain("Only  words");
  });
});

describe("scoreBand", () => {
  it("maps scores to bands at the documented thresholds", () => {
    expect([100, 85, 84, 70, 69, 50, 49, 0].map(scoreBand)).toEqual([
      "excellent", "excellent", "good", "good", "fair", "fair", "poor", "poor",
    ]);
  });
});

describe("CSP", () => {
  it("is strict in production", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toMatch(/https?:/);
  });

  it("relaxes only what the dev server needs", () => {
    const csp = buildCsp("abc", true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("creates unpredictable 128-bit nonces", () => {
    const nonces = new Set(Array.from({ length: 1_000 }, createNonce));
    expect(nonces.size).toBe(1_000);
    for (const n of nonces) expect(Buffer.from(n, "base64")).toHaveLength(16);
  });
});
