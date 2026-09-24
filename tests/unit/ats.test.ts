import { describe, expect, it } from "vitest";
import { analyzeResume, WEIGHTS_WITH_JOB, WEIGHTS_WITHOUT_JOB } from "@/lib/ats/analyze";
import { detectContact, isPhoneCandidate } from "@/lib/ats/contact";
import { analyzeContent } from "@/lib/ats/content";
import { extractJobKeywords, indexText, matchKeywords } from "@/lib/ats/keywords";
import { detectLanguage } from "@/lib/ats/language";
import { detectSections } from "@/lib/ats/sections";
import { FINDING_IDS, type FindingId } from "@/lib/ats/types";
import { fold, normalizeText, stripUnsafeChars } from "@/lib/text/normalize";
import { countPhrase, padded, stem, tokenize } from "@/lib/text/tokenize";

const RESUME_EN = `Jane Doe
Senior Software Engineer
jane.doe@example.com | +1 (555) 123-4567 | linkedin.com/in/janedoe | São Paulo

Summary
Backend engineer with 6 years of experience building APIs in Python and TypeScript.

Experience
Senior Software Engineer — Acme Corp
Jan 2021 – Present
• Led the migration of 40 services to Kubernetes, cutting infra costs by 30%.
• Built a Django REST API serving 2M requests per day.
• Reduced p95 latency from 800 ms to 120 ms with Redis caching.
• Mentored 5 junior engineers and introduced code reviews.
• Designed CI/CD pipelines with GitHub Actions and Docker.

Software Engineer — Beta Ltd
Mar 2018 – Dec 2020
• Developed React dashboards used by 300 customers.
• Implemented automated tests with pytest, raising coverage to 85%.

Education
B.Sc. Computer Science — State University, 2014 – 2017

Skills
Python, TypeScript, Django, React, PostgreSQL, Docker, Kubernetes, AWS, Git`;

const JOB_EN = `Backend Engineer (Python)
We are looking for a backend engineer to join our platform team.

Requirements
- 4+ years of experience with Python and Django
- Solid experience with PostgreSQL and Redis
- Experience with Docker, Kubernetes and AWS
- Familiarity with Kafka and event-driven architecture
- Experience with Terraform is a plus
- Strong communication skills

Benefits
- Health insurance, remote work`;

const RESUME_PT = `Maria Silva
Desenvolvedora Full Stack
maria.silva@example.com | (11) 91234-5678 | linkedin.com/in/mariasilva

Resumo
Desenvolvedora com 5 anos de experiência em aplicações web com React e Node.js.

Experiência Profissional
Desenvolvedora Full Stack — Empresa X
03/2020 – Atual
• Desenvolvi o novo portal do cliente em React, aumentando a conversão em 20%.
• Reduzi o tempo de resposta da API em 60% com cache Redis.
• Implementei testes automatizados e integração contínua.
• Liderei a migração do banco para PostgreSQL.
• Criei dashboards de análise de dados para 12 áreas.

Formação Acadêmica
Bacharelado em Ciência da Computação — USP, 2015 – 2019

Habilidades
JavaScript, TypeScript, React, Node.js, PostgreSQL, Redis, Git`;

describe("text utilities", () => {
  it("normalizes whitespace, line endings and unsafe characters", () => {
    const { text, truncated } = normalizeText("a  b\r\n\r\n\r\n\r\nc‮d\u0000e﻿  ");
    expect(text).toBe("a b\n\ncde");
    expect(truncated).toBe(false);
    expect(normalizeText("x".repeat(50), 10)).toEqual({ text: "x".repeat(10), truncated: true });
    expect(normalizeText("ﬁle")).toEqual({ text: "file", truncated: false });
  });

  it("strips bidi overrides and control characters", () => {
    expect(stripUnsafeChars("safe‮txt.exe⁦\u0007")).toBe("safetxt.exe");
  });

  it("folds case and diacritics", () => {
    expect(fold("Gestão AÇÃO Économie")).toBe("gestao acao economie");
  });

  it("tokenizes tech names correctly", () => {
    expect(tokenize("C++, C#, Node.js, .NET, CI/CD, front-end, C/C++, React's, UI/UX.")).toEqual([
      "c++", "c#", "node.js", "dotnet", "ci/cd", "front", "end", "c", "c++", "react", "ui/ux",
    ]);
    expect(tokenize("2019-2024, Jan 2020-Present, you'll, e.g.")).toEqual(["2019", "2024", "jan", "2020", "present", "you", "ll", "e.g"]);
    expect(tokenize("Experiência em Gestão")).toEqual(["experiencia", "em", "gestao"]);
  });

  it("stems plurals in both languages", () => {
    expect(stem("gestoes")).toBe("gestao");
    expect(stem("profissionais")).toBe("profissional");
    expect(stem("responsaveis")).toBe("responsavel");
    expect(stem("technologies")).toBe("technology");
    expect(stem("desenvolvedores")).toBe("desenvolvedor");
    expect(stem("services")).toBe(stem("service"));
    expect(stem("features")).toBe(stem("feature"));
    expect(stem("processes")).toBe(stem("process"));
    expect(stem("architectures")).toBe(stem("architecture"));
    expect(stem("designed")).toBe(stem("design"));
    expect(stem("testing")).toBe(stem("tests"));
    expect(stem("spring")).toBe("spring");
    expect(stem("string")).toBe("string");
    expect(stem("business")).toBe("business");
    expect(stem("status")).toBe("status");
    expect(stem("aws")).toBe("aws");
    expect(stem("node.js")).toBe("node.js");
  });

  it("counts whole-phrase occurrences only", () => {
    const hay = padded(tokenize("machine learning and machine learning, not machinelearning"));
    expect(countPhrase(hay, ["machine", "learning"])).toBe(2);
    expect(countPhrase(hay, [])).toBe(0);
    expect(countPhrase(padded(["reactive"]), ["react"])).toBe(0);
  });
});

describe("language detection", () => {
  it("detects English and Portuguese", () => {
    expect(detectLanguage(RESUME_EN)).toBe("en");
    expect(detectLanguage(RESUME_PT)).toBe("pt");
    expect(detectLanguage(JOB_EN)).toBe("en");
  });

  it("returns unknown for keyword lists", () => {
    expect(detectLanguage("Python Docker AWS")).toBe("unknown");
  });
});

describe("sections", () => {
  it("finds standard headings in English and Portuguese", () => {
    expect(detectSections(RESUME_EN).found).toEqual(["summary", "experience", "education", "skills"]);
    expect(detectSections(RESUME_PT).found).toEqual(["summary", "experience", "education", "skills"]);
  });

  it("accepts decorated headings", () => {
    const report = detectSections("• EXPERIENCE:\n— Skills & Tools\n1. Education\nCertificações\nIdiomas");
    expect(report.found).toEqual(["experience", "education", "skills", "certifications", "languages"]);
  });

  it("flags creative headings with a suggestion", () => {
    expect(detectSections("Sobre mim\nsome text").nonstandard).toEqual([{ heading: "Sobre mim", suggestion: "summary" }]);
    expect(detectSections("About\nSummary").nonstandard).toEqual([]);
  });

  it("recognizes headings prefixed by an icon glyph, but reports them", () => {
    const report = detectSections("l PROFESSIONAL EXPERIENCE\nÔ TECHNICAL SKILLS\nÇ PROJETOS\nEducation\nl EDUCATION");
    expect(report.found).toEqual(["education"]);
    expect(report.decorated).toEqual([
      { heading: "l PROFESSIONAL EXPERIENCE", section: "experience" },
      { heading: "Ô TECHNICAL SKILLS", section: "skills" },
      { heading: "Ç PROJETOS", section: "projects" },
    ]);
  });

  it("ignores long lines that merely contain a heading word", () => {
    expect(detectSections("I have experience with many things in my career so far").found).toEqual([]);
  });
});

describe("contact", () => {
  it("finds email, phone and LinkedIn", () => {
    expect(detectContact(RESUME_EN)).toEqual({ email: true, phone: true, linkedin: "url" });
    expect(detectContact(RESUME_PT)).toEqual({ email: true, phone: true, linkedin: "url" });
  });

  it("recognizes a LinkedIn label without URL", () => {
    expect(detectContact("Email: <a@b.co> · LinkedIn · GitHub").linkedin).toBe("label");
    expect(detectContact("mailto:a@b.co").email).toBe(true);
  });

  it("does not mistake year ranges for phone numbers", () => {
    expect(isPhoneCandidate("2019 - 2023")).toBe(false);
    expect(isPhoneCandidate("+55 11 91234-5678")).toBe(true);
    expect(isPhoneCandidate("123")).toBe(false);
    expect(detectContact("Worked 2019 - 2023 at Foo").phone).toBe(false);
  });

  it("is bounded on hostile input", () => {
    const started = performance.now();
    detectContact(`${"a".repeat(100_000)}@${"b.".repeat(50_000)} ${"1 ".repeat(50_000)}`);
    expect(performance.now() - started).toBeLessThan(1_500);
  });
});

describe("content", () => {
  it("counts bullets, metrics, verbs and dates", () => {
    const report = analyzeContent(RESUME_EN);
    expect(report.bullets).toBe(7);
    expect(report.quantified).toBeGreaterThanOrEqual(5);
    expect(report.actionVerbs).toBeGreaterThanOrEqual(6);
    expect(report.years).toBeGreaterThanOrEqual(4);
    expect(report.garbled).toBe(0);
  });

  it("recognizes Portuguese action verbs", () => {
    expect(analyzeContent(RESUME_PT).actionVerbs).toBeGreaterThanOrEqual(5);
  });

  it("counts icon-font and cid garbage", () => {
    expect(analyzeContent(" email  phone (cid:12) �").garbled).toBe(4);
  });

  it("counts icon glyphs mapped to ordinary characters", () => {
    expect(analyzeContent("+55 51 99999-9999 # me@x.com\n§ github.com/me ï linkedin.com/in/me").garbled).toBe(3);
    // Separators and one-letter words are fine.
    expect(analyzeContent("Python · Django | SQL — A e o é à 2 → 3 - x & y").garbled).toBe(0);
  });

  it("finds action verbs after STAR labels", () => {
    expect(analyzeContent("– Action: built a pipeline for the team\n– Resultado: reduzi custos em 20%").actionVerbs).toBe(2);
  });

  it("does not count years as metrics", () => {
    expect(analyzeContent("Worked at the company between 2019 and 2021").quantified).toBe(0);
  });
});

describe("keywords", () => {
  it("extracts skills and requirement terms from a job", () => {
    const terms = extractJobKeywords(JOB_EN).map((k) => k.term);
    expect(terms).toEqual(expect.arrayContaining(["Python", "Django", "PostgreSQL", "Redis", "Docker", "Kubernetes", "AWS", "Kafka", "Terraform"]));
    // Noise and benefits vocabulary never become keywords.
    expect(terms).not.toContain("insurance");
    expect(terms).not.toContain("experience");
  });

  it("does not treat everyday words as skills", () => {
    const terms = extractJobKeywords("You will excel at solid work and rest well. Go above and beyond.").map((k) => k.term);
    expect(terms).not.toContain("Excel");
    expect(terms).not.toContain("SOLID");
    expect(terms).not.toContain("REST");
    expect(terms).not.toContain("Go");
    const cased = extractJobKeywords("Must know Excel, Go and REST APIs, plus SOLID principles.").map((k) => k.term);
    expect(cased).toEqual(expect.arrayContaining(["Excel", "Go", "REST", "SOLID"]));
  });

  it("matches across languages through skill aliases", () => {
    const job = extractJobKeywords("Experience with machine learning and unit tests");
    const match = matchKeywords(job, indexText("Projetos de aprendizado de máquina e testes unitários"));
    expect(match.matched.map((k) => k.term)).toEqual(expect.arrayContaining(["Machine Learning", "Unit Testing"]));
  });

  it("scores the sample resume against the job", () => {
    const match = matchKeywords(extractJobKeywords(JOB_EN), indexText(RESUME_EN));
    expect(match.score).toBeGreaterThan(50);
    expect(match.missing.map((k) => k.term)).toEqual(expect.arrayContaining(["Kafka", "Terraform"]));
    expect(match.stuffed).toEqual([]);
  });

  it("flags keyword stuffing", () => {
    const stuffed = `Python ${"python ".repeat(30)} developer`;
    const match = matchKeywords(extractJobKeywords("We need Python"), indexText(stuffed));
    expect(match.stuffed[0]).toMatchObject({ term: "Python" });
  });

  it("returns an empty score when the job has no keywords", () => {
    expect(matchKeywords([], indexText("x")).score).toBe(0);
  });
});

describe("analyzeResume", () => {
  const ids = (r: ReturnType<typeof analyzeResume>) => r.findings.map((f) => f.id);

  it("scores a solid English resume well without a job", () => {
    const result = analyzeResume({ resumeText: RESUME_EN });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.categories.keywords).toBeNull();
    expect(result.categories.parseability?.weight).toBe(WEIGHTS_WITHOUT_JOB.parseability);
    expect(result.language.resume).toBe("en");
    expect(ids(result)).toEqual(expect.arrayContaining(["text.readable", "contact.email", "sections.found", "content.quantified"]));
  });

  it("adds keyword analysis when a job is provided", () => {
    const result = analyzeResume({ resumeText: RESUME_EN, jobText: JOB_EN });
    expect(result.categories.keywords?.weight).toBe(WEIGHTS_WITH_JOB.keywords);
    expect(result.keywords?.missing.map((k) => k.term)).toContain("Kafka");
    expect(ids(result)).toContain("keywords.match");
  });

  it("scores a Portuguese resume and warns about a language mismatch", () => {
    const result = analyzeResume({ resumeText: RESUME_PT, jobText: JOB_EN });
    expect(result.language).toEqual({ resume: "pt", job: "en" });
    expect(ids(result)).toContain("language.mismatch");
  });

  it("returns a critical finding for unreadable documents", () => {
    const result = analyzeResume({ resumeText: "   \n  " });
    expect(result.score).toBe(0);
    expect(ids(result)).toEqual(["text.empty"]);
  });

  it("penalizes ATS-hostile layout", () => {
    const clean = analyzeResume({ resumeText: RESUME_EN });
    const messy = analyzeResume({
      resumeText: RESUME_EN,
      layout: { tables: 2, textBoxes: 1, columns: true, images: 1, pageCount: 4 },
      truncated: true,
    });
    expect(messy.score).toBeLessThan(clean.score);
    expect(ids(messy)).toEqual(
      expect.arrayContaining(["layout.tables", "layout.textBoxes", "layout.columns", "layout.images", "layout.pages", "text.truncated"]),
    );
  });

  it("detects contact details hidden in headers/footers", () => {
    const body = RESUME_EN.replace("jane.doe@example.com | +1 (555) 123-4567 | ", "");
    const result = analyzeResume({ resumeText: body, headerFooterText: "jane.doe@example.com +1 (555) 123-4567" });
    expect(ids(result)).toContain("layout.headerFooterContact");
    expect(ids(result)).not.toContain("contact.emailMissing");
  });

  it("reports missing sections, contact data, dates and weak content", () => {
    const text = "Some Person\nI am a developer and I like my work and I love my job.\n".repeat(8);
    const result = analyzeResume({ resumeText: text });
    expect(ids(result)).toEqual(
      expect.arrayContaining([
        "sections.missing",
        "sections.summaryMissing",
        "contact.emailMissing",
        "contact.phoneMissing",
        "contact.linkedinMissing",
        "content.datesMissing",
        "content.quantifiedLow",
        "content.actionVerbsLow",
        "content.bulletsMissing",
        "content.pronouns",
        "text.short",
      ]),
    );
    expect(result.score).toBeLessThan(40);
  });

  it("gives half credit to icon-prefixed headings", () => {
    const iconized = RESUME_EN.replace("Experience\nSenior", "l EXPERIENCE\nSenior").replace("Skills\nPython", "Ô SKILLS\nPython");
    const clean = analyzeResume({ resumeText: RESUME_EN });
    const result = analyzeResume({ resumeText: iconized });
    expect(ids(result)).toContain("sections.decorated");
    expect(ids(result)).not.toContain("sections.missing");
    expect(result.categories.sections!.score).toBeLessThan(clean.categories.sections!.score);
  });

  it("flags garbled text, nonstandard headings, short jobs and long resumes", () => {
    const text = `Sobre mim\n${"".repeat(5)}\n${"palavra ".repeat(1400)}`;
    const result = analyzeResume({ resumeText: text, jobText: "Python" });
    expect(ids(result)).toEqual(expect.arrayContaining(["text.garbled", "sections.nonstandard", "keywords.jobShort", "text.long"]));
  });

  it("sorts findings by severity and never exceeds 0..100", () => {
    const result = analyzeResume({ resumeText: RESUME_EN, jobText: JOB_EN });
    const order = { critical: 0, warning: 1, info: 2, pass: 3 };
    const severities = result.findings.map((f) => order[f.severity]);
    expect([...severities].sort((a, b) => a - b)).toEqual(severities);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("only emits known finding ids", () => {
    const known = new Set<FindingId>(FINDING_IDS);
    for (const r of [analyzeResume({ resumeText: RESUME_EN, jobText: JOB_EN }), analyzeResume({ resumeText: RESUME_PT })]) {
      for (const f of r.findings) expect(known.has(f.id)).toBe(true);
    }
  });

  it("stays fast on a maximum-size adversarial input", () => {
    const hostile = `${"a.".repeat(20_000)}${"1".repeat(10_000)}\n${"•x ".repeat(5_000)}`;
    const started = performance.now();
    analyzeResume({ resumeText: hostile, jobText: hostile.slice(0, 20_000) });
    expect(performance.now() - started).toBeLessThan(3_000);
  });
});
