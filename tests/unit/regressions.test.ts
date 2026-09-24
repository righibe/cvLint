// One test per issue found in the security and correctness reviews.
import { strToU8 } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeResume } from "@/lib/ats/analyze";
import { detectContact, isPhoneCandidate } from "@/lib/ats/contact";
import { analyzeContent } from "@/lib/ats/content";
import { extractJobKeywords, indexText, lineWeights, matchKeywords } from "@/lib/ats/keywords";
import { detectSections } from "@/lib/ats/sections";
import { detectDocxLayout, docxXmlToText } from "@/lib/parser/docx";
import { assemblePage, looksMultiColumn } from "@/lib/parser/pdf";
import { detectFormat } from "@/lib/parser/sniff";
import { decodeTextFile } from "@/lib/parser/txt";
import { formatMonth, normalizeMonth } from "@/lib/resume/format";
import { importResumeJson } from "@/lib/resume/import";
import { emptyResume, resumeSchema } from "@/lib/resume/schema";
import { getPersistence, loadResume, readBackup, saveResume, setPersistence } from "@/lib/resume/storage";
import { normalizeText } from "@/lib/text/normalize";
import { para, wordXml } from "../helpers/fixtures";

const skillsIn = (job: string) => extractJobKeywords(job).filter((k) => k.kind === "skill").map((k) => k.term);
const matchedIn = (job: string, resume: string) => matchKeywords(extractJobKeywords(job), indexText(resume)).matched.map((k) => k.term);

describe("keywords: a skill inside a longer skill", () => {
  it("React Native is not React, SQL Server is not SQL", () => {
    expect(matchedIn("Requirements: React", "Built apps with React Native")).toEqual([]);
    expect(matchedIn("Requirements: SQL", "Administered SQL Server")).toEqual([]);
    expect(matchedIn("Requirements: React and React Native", "React Native and React")).toEqual(["React", "React Native"]);
  });

  it("Spring Boot and GitHub Actions are single requirements", () => {
    expect(skillsIn("Experience with Spring Boot and GitHub Actions")).toEqual(["GitHub Actions", "Spring Boot"]);
    expect(matchedIn("We use Spring Boot", "Spring framework")).toEqual([]);
  });

  it("still separates Java from JavaScript", () => {
    expect(matchedIn("Java developer", "JavaScript developer")).toEqual([]);
  });
});

describe("keywords: ambiguous words", () => {
  it("ignores hyphenated and sentence-initial uses", () => {
    const skills = skillsIn("Own our go-to-market. Report to C-level. Series C startup.\n• Excel in fast teams\n• Express ideas clearly\n• Spark innovation");
    expect(skills).toEqual([]);
  });

  it("keeps real list uses", () => {
    expect(skillsIn("Stack: Go, C, Excel\n• Spark, Kafka\nC/C++ required")).toEqual(expect.arrayContaining(["Go", "C", "C++", "Excel", "Spark", "Kafka"]));
    expect(matchedIn("Languages: C, Python", "John C. Smith, Python developer")).toEqual(["Python"]);
  });
});

describe("keywords: job-ad structure", () => {
  const job = `Backend developer
Requisitos
- Python e Django
Benefícios
- Aulas de inglês, Gympass, plano de saúde
Sobre a empresa
Somos uma fintech de pagamentos`;

  it("ignores benefits and company blurb", () => {
    const terms = extractJobKeywords(job).map((k) => k.term);
    expect(terms).toEqual(expect.arrayContaining(["Python", "Django"]));
    for (const noise of ["English", "gympass", "fintech", "pagamentos", "aulas"]) expect(terms).not.toContain(noise);
  });

  it("weights sections", () => {
    expect(lineWeights(["Intro", "Requirements", "a", "Nice to have", "b", "Benefits", "c", "Responsibilities", "d"])).toEqual([
      1, 1.5, 1.5, 0.75, 0.75, 0, 0, 1, 1,
    ]);
  });

  it("does not turn single words of a short ad into requirements", () => {
    const terms = extractJobKeywords("We are a growing company with future plans. Python.").map((k) => k.term);
    expect(terms).toEqual(["Python"]);
  });

  it("matches plural and verb forms", () => {
    const job = "Requirements\n- Build features\n- Design architectures\n- Design features";
    const match = matchKeywords(extractJobKeywords(job), indexText("Designed the architecture of a feature flag service"));
    expect(match.missing.map((k) => k.term)).toEqual([]);
  });

  it("keyword stuffing never raises the score", () => {
    const base = "Jane Doe\nEngineer building Python services with Django for 5 years at Acme.";
    const job = "Requirements: Python, Django, Kafka";
    const honest = matchKeywords(extractJobKeywords(job), indexText(base));
    const stuffed = matchKeywords(extractJobKeywords(job), indexText(`${base}\n${"Kafka ".repeat(30)}`));
    expect(stuffed.stuffed[0]?.term).toBe("Kafka");
    expect(stuffed.score).toBeLessThanOrEqual(honest.score);
  });
});

describe("dates and content", () => {
  it("counts hyphenated year ranges as dates and not as metrics", () => {
    const report = analyzeContent("Engineer at Acme, 2019-2024\nAnalyst at Beta, Jan 2017-Dec 2018");
    expect(report.years).toBe(4);
    expect(report.quantified).toBe(0);
  });

  it("recognizes co- prefixed verbs", () => {
    expect(analyzeContent("– Co-founded a developer community of 18k members").actionVerbs).toBe(1);
  });
});

describe("contact: phone false positives", () => {
  it.each(["01310-100", "123.456.789-00", "01.2019 - 12.2022", "2015-2016-2017", "12345678"])("%s is not a phone", (s) => {
    expect(isPhoneCandidate(s)).toBe(false);
  });

  it.each(["(51) 99601-1501", "51 99601-1501", "+55 11 91234-5678", "555-123-4567", "+1 555 123 4567"])("%s is a phone", (s) => {
    expect(isPhoneCandidate(s)).toBe(true);
  });

  it("does not report a phone for a CEP in an address", () => {
    expect(detectContact("Rua X, 100 - CEP 01310-100 - São Paulo").phone).toBe(false);
  });
});

describe("sections", () => {
  it("detects inline headings and combined headings", () => {
    const report = detectSections("Skills: Python, SQL\nIdiomas: Inglês\nEducation & Certifications");
    expect(report.found).toEqual(["education", "skills", "certifications", "languages"]);
  });

  it("does not treat bullets as headings", () => {
    expect(detectSections("• Projects delivered on time\n• Profile optimization work").found).toEqual([]);
  });

  it("never resolves Object.prototype members", () => {
    expect(detectSections("Constructor\ntoString\nhasOwnProperty").nonstandard).toEqual([]);
  });

  it("suggests the heading in the resume's language", () => {
    const pt = `Sobre\nDesenvolvedora com experiência em projetos de dados para a empresa e para os clientes.\n${"Trabalhei com a equipe de dados. ".repeat(10)}`;
    const finding = analyzeResume({ resumeText: pt }).findings.find((f) => f.id === "sections.nonstandard");
    expect(finding?.params?.suggestion).toBe("Resumo");
  });
});

describe("PDF layout heuristics", () => {
  const run = (str: string, x: number, y: number, width = str.length * 5, height = 10) => ({ str, x, y, width, height });

  it("centered headings are not a right column", () => {
    const items = [];
    for (let i = 0; i < 14; i += 1) {
      items.push(i % 2 === 0 ? run("SECTION TITLE", 270, 700 - i * 14, 72) : run("Normal body line of text here", 40, 700 - i * 14));
    }
    expect(looksMultiColumn([assemblePage(items, 612)])).toBe(false);
  });

  it("keeps superscripts on their line and drops fake-bold duplicates", () => {
    const page = assemblePage([run("st", 56, 704, 8, 6), run("1", 50, 700, 6, 11), run("EXPERIENCE", 50, 680), run("EXPERIENCE", 50.5, 680)], 612);
    expect(page.lines).toEqual(["1st", "EXPERIENCE"]);
  });
});

describe("parser odds and ends", () => {
  it("counts a text box once and keeps non-breaking hyphens", () => {
    const box = `<w:txbxContent>${para("Boxed")}</w:txbxContent>`;
    const xml = wordXml(`<mc:AlternateContent><mc:Choice>${box}</mc:Choice><mc:Fallback>${box}<w:tbl/></mc:Fallback></mc:AlternateContent>`);
    expect(detectDocxLayout(xml, 0)).toMatchObject({ textBoxes: 1, tables: 0 });
    expect(docxXmlToText(wordXml(`<w:p><w:r><w:t>91234</w:t><w:noBreakHyphen/><w:t>5678</w:t></w:r></w:p>`))).toBe("91234-5678\n");
  });

  it("decodes UTF-16 text files with a BOM", () => {
    const le = new Uint8Array([0xff, 0xfe, 0x4f, 0x00, 0x69, 0x00]);
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x4f, 0x00, 0x69]);
    expect(decodeTextFile(le)).toBe("Oi");
    expect(decodeTextFile(be)).toBe("Oi");
  });

  it("accepts files without extension and DOCX packages named .doc", () => {
    expect(detectFormat(strToU8("%PDF-1.7"), "resume")).toBe("pdf");
    expect(detectFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "resume.doc")).toBe("docx");
  });

  it("bounds normalization work before NFKC expansion", () => {
    const started = performance.now();
    const { text, truncated } = normalizeText("ﷺ".repeat(5_000_000));
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(60_000);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

describe("resume data never gets wiped", () => {
  it("truncates over-long fields instead of rejecting the document", () => {
    const data = emptyResume();
    const parsed = resumeSchema.safeParse({
      ...data,
      basics: { ...data.basics, name: "x".repeat(10_000) },
      skills: [{ name: "Tools", keywords: ["y".repeat(500)] }],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.basics.name).toHaveLength(120);
    expect(parsed.data?.skills[0]?.keywords[0]).toHaveLength(60);
  });

  it("understands the dates people actually type", () => {
    expect(normalizeMonth("03/2020")).toBe("2020-03");
    expect(normalizeMonth("3.2020")).toBe("2020-03");
    expect(normalizeMonth("Mar 2020")).toBe("2020-03");
    expect(normalizeMonth("março de 2020")).toBe("2020-03");
    expect(normalizeMonth("2020-03-15")).toBe("2020-03");
    expect(normalizeMonth("2020")).toBe("2020");
    expect(normalizeMonth("13/2020")).toBe("");
    expect(normalizeMonth("constructor 2020")).toBe("");
    expect(normalizeMonth("soon")).toBe("");
    expect(formatMonth("2015", "en")).toBe("2015");
    expect(formatMonth("03/2020", "en")).toBe("Mar 2020");
  });

  it("keeps year-only JSON Resume dates", () => {
    const result = importResumeJson(JSON.stringify({ basics: { name: "A" }, education: [{ institution: "U", startDate: "2015", endDate: "2019" }] }), "en");
    expect(result.ok && result.data.education[0]).toMatchObject({ startDate: "2015", endDate: "2019" });
  });
});

describe("storage preferences", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("remembers the opt-out and exposes the unreadable backup", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    expect(getPersistence()).toBe(true);
    setPersistence(false);
    expect(getPersistence()).toBe(false);
    setPersistence(true);
    expect(getPersistence()).toBe(true);

    store.set("cvlint:resume:v1", "{oops");
    expect(loadResume()).toEqual({ status: "unreadable" });
    expect(readBackup()).toBe("{oops");
    expect(saveResume(emptyResume())).toBe(true);
  });
});
