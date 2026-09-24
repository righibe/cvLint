import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { displayUrl, formatMonth, formatRange } from "@/lib/resume/format";
import { fromJsonResume, importResumeJson, safeJsonParse } from "@/lib/resume/import";
import { sampleResume } from "@/lib/resume/sample";
import { emptyResume, isValidEmail, MAX_IMPORT_BYTES, resumeSchema, toSafeUrl } from "@/lib/resume/schema";
import { clearResume, loadResume, saveResume } from "@/lib/resume/storage";
import { resumeToText } from "@/lib/resume/to-text";
import { analyzeResume } from "@/lib/ats/analyze";

describe("toSafeUrl", () => {
  it("accepts http(s) and bare domains", () => {
    expect(toSafeUrl("https://github.com/jane")).toBe("https://github.com/jane");
    expect(toSafeUrl("linkedin.com/in/jane")).toBe("https://linkedin.com/in/jane");
    expect(toSafeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects dangerous or malformed URLs", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "java\u0000script:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "https://user:pass@example.com",
      "localhost",
      "",
      "https://" + "a".repeat(400) + ".com",
    ]) {
      expect(toSafeUrl(bad), bad).toBeNull();
    }
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses and rejects mailto header injection", () => {
    expect(isValidEmail("jane.doe+cv@example.com.br")).toBe(true);
    expect(isValidEmail("jane@example.com?cc=boss@example.com")).toBe(false);
    expect(isValidEmail("jane@example.com&body=hi")).toBe(false);
    expect(isValidEmail("not an email")).toBe(false);
  });
});

describe("resumeSchema", () => {
  it("round-trips the sample resumes", () => {
    for (const lang of ["en", "pt"] as const) {
      const sample = sampleResume(lang);
      expect(resumeSchema.parse(sample)).toEqual(sample);
    }
  });

  it("normalizes months and trims long text instead of failing", () => {
    const data = emptyResume();
    const parsed = resumeSchema.parse({
      ...data,
      basics: { ...data.basics, name: `  ${"x".repeat(150)}  `, summary: "ok‮" },
      work: [{ company: "A", position: "B", location: "", startDate: "2020", endDate: "2020-13", current: false, highlights: [] }],
    });
    expect(parsed.basics.name).toHaveLength(120);
    expect(parsed.basics.summary).toBe("ok");
    expect(parsed.work[0]?.startDate).toBe("2020");
    expect(parsed.work[0]?.endDate).toBe("");
  });

  it("rejects oversized payloads and too many items", () => {
    const data = emptyResume();
    expect(resumeSchema.safeParse({ ...data, languages: Array(11).fill({ language: "x", fluency: "y" }) }).success).toBe(false);
    expect(resumeSchema.safeParse({ ...data, version: 2 }).success).toBe(false);
    expect(resumeSchema.safeParse({ ...data, meta: { language: "fr", template: "classic" } }).success).toBe(false);
  });

  it("strips unknown keys", () => {
    const parsed = resumeSchema.parse({ ...emptyResume(), evil: true, basics: { ...emptyResume().basics, onclick: "x" } });
    expect(parsed).not.toHaveProperty("evil");
    expect(parsed.basics).not.toHaveProperty("onclick");
  });
});

describe("import", () => {
  it("imports a cvlint export", () => {
    const sample = sampleResume("pt");
    const result = importResumeJson(JSON.stringify(sample), "en");
    expect(result).toEqual({ ok: true, data: sample });
  });

  it("imports JSON Resume documents", () => {
    const jsonResume = {
      basics: {
        name: "John",
        email: "john@example.com",
        location: { city: "Lisbon", countryCode: "PT" },
        profiles: [{ network: "GitHub", url: "https://github.com/john" }],
      },
      work: [
        { name: "Acme", position: "Dev", startDate: "2020-01-15", endDate: "2021-06-01", highlights: ["Did things"] },
        { company: "Beta", position: "Lead", startDate: "2021-07", summary: "Leading" },
      ],
      education: [{ institution: "Uni", area: "CS", studyType: "BSc", startDate: "2015", endDate: "2019-07-01" }],
      skills: [{ name: "Web", keywords: ["React", 42, null] }],
      languages: [{ language: "English", fluency: "Fluent" }],
      certificates: [{ name: "AWS", issuer: "Amazon", date: "2022-03-01" }],
      projects: [{ name: "P", description: "D", url: "https://p.dev", highlights: ["h"] }],
    };
    const result = importResumeJson(JSON.stringify(jsonResume), "en");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.basics.location).toBe("Lisbon, PT");
    expect(result.data.work[0]).toMatchObject({ company: "Acme", startDate: "2020-01", endDate: "2021-06", current: false });
    expect(result.data.work[1]).toMatchObject({ company: "Beta", current: true, highlights: ["Leading"] });
    expect(result.data.education[0]?.startDate).toBe("2015");
    expect(result.data.skills[0]?.keywords).toEqual(["React", "42"]);
    expect(result.data.certificates[0]?.date).toBe("2022-03");
  });

  it("maps non-object sections defensively", () => {
    const mapped = fromJsonResume({ basics: "nope", work: "nope", skills: [1, "x"] }, "pt") as ReturnType<typeof emptyResume>;
    expect(mapped.work).toEqual([]);
    expect(mapped.skills).toEqual([]);
    expect(mapped.meta.language).toBe("pt");
  });

  it("never pollutes prototypes", () => {
    const payload = `{"version":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"basics":{"__proto__":{"x":1}}}`;
    const parsed = safeJsonParse(payload) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(parsed, "__proto__")).toBe(false);
    importResumeJson(payload, "en");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("reports clear errors", () => {
    expect(importResumeJson("{not json", "en")).toEqual({ ok: false, error: "invalid_json" });
    expect(importResumeJson("[1,2]", "en")).toEqual({ ok: false, error: "invalid_schema" });
    expect(importResumeJson('{"hello":1}', "en")).toEqual({ ok: false, error: "invalid_schema" });
    expect(importResumeJson(`{"version":1}`, "en")).toEqual({ ok: false, error: "invalid_schema" });
    expect(importResumeJson(" ".repeat(MAX_IMPORT_BYTES + 1), "en")).toEqual({ ok: false, error: "too_large" });
  });
});

describe("format", () => {
  it("formats months and ranges per language", () => {
    expect(formatMonth("2021-03", "en")).toBe("Mar 2021");
    expect(formatMonth("2021-03", "pt")).toBe("03/2021");
    expect(formatMonth("bad", "en")).toBe("");
    expect(formatRange("2020-01", "2021-02", false, "en")).toBe("Jan 2020 – Feb 2021");
    expect(formatRange("2020-01", "", true, "pt")).toBe("01/2020 – Atual");
    expect(formatRange("", "2021-02", false, "en")).toBe("Feb 2021");
    expect(displayUrl("https://github.com/x/")).toBe("github.com/x");
  });
});

describe("resumeToText", () => {
  it("produces text that the ATS engine scores highly", () => {
    for (const lang of ["en", "pt"] as const) {
      const text = resumeToText(sampleResume(lang));
      expect(text).toContain("Alex Moreira");
      const result = analyzeResume({ resumeText: text });
      expect(result.language.resume).toBe(lang);
      expect(result.findings.filter((f) => f.severity === "critical")).toEqual([]);
      expect(result.score).toBeGreaterThanOrEqual(80);
    }
  });

  it("drops unsafe links from the text output", () => {
    const data = sampleResume("en");
    data.basics.url = "javascript:alert(1)";
    expect(resumeToText(data)).not.toContain("javascript");
  });

  it("handles an empty resume", () => {
    expect(resumeToText(emptyResume())).toBe("");
  });
});

describe("storage", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("saves, loads and clears", () => {
    expect(loadResume()).toEqual({ status: "empty" });
    const sample = sampleResume("en");
    expect(saveResume(sample)).toBe(true);
    expect(loadResume()).toEqual({ status: "ok", data: sample });
    clearResume();
    expect(loadResume()).toEqual({ status: "empty" });
  });

  it("keeps a backup of unreadable data instead of deleting it", () => {
    store.set("cvlint:resume:v1", "{broken");
    expect(loadResume()).toEqual({ status: "unreadable" });
    expect(store.get("cvlint:resume:unreadable")).toBe("{broken");
    expect(loadResume()).toEqual({ status: "unreadable" });
  });

  it("survives storage that throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("SecurityError");
      },
    });
    expect(loadResume()).toEqual({ status: "empty" });
    expect(saveResume(emptyResume())).toBe(false);
    expect(() => clearResume()).not.toThrow();
  });

  it("survives quota errors", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => undefined,
      },
    });
    expect(loadResume()).toEqual({ status: "empty" });
    expect(saveResume(emptyResume())).toBe(false);
  });
});
