import type { Lang } from "../ats/types";
import { RESUME_SCHEMA_VERSION, type ResumeData } from "./schema";

/** Fictional person used by "Load example". */
export function sampleResume(lang: Lang): ResumeData {
  const pt = lang === "pt";
  return {
    version: RESUME_SCHEMA_VERSION,
    meta: { language: lang, template: "classic" },
    basics: {
      name: "Alex Moreira",
      label: pt ? "Desenvolvedor Full Stack" : "Full Stack Developer",
      email: "alex.moreira@example.com",
      phone: "+55 11 91234-5678",
      location: "São Paulo, SP",
      url: "https://alexmoreira.dev",
      summary: pt
        ? "Desenvolvedor full stack com 4 anos de experiência em TypeScript, React e Node.js. Foco em produtos web acessíveis, testes automatizados e entrega contínua."
        : "Full stack developer with 4 years of experience in TypeScript, React and Node.js. Focused on accessible web products, automated testing and continuous delivery.",
      profiles: [
        { network: "LinkedIn", url: "https://linkedin.com/in/alex-moreira-example" },
        { network: "GitHub", url: "https://github.com/alex-moreira-example" },
      ],
    },
    work: [
      {
        company: "Loja Rápida",
        position: pt ? "Desenvolvedor Full Stack" : "Full Stack Developer",
        location: "São Paulo, SP",
        startDate: "2022-03",
        endDate: "",
        current: true,
        highlights: pt
          ? [
              "Desenvolvi o novo checkout em React e Next.js, aumentando a conversão em 18%.",
              "Reduzi o tempo de resposta da API de pedidos de 900 ms para 250 ms com cache Redis.",
              "Implementei pipeline de CI/CD no GitHub Actions com testes automatizados (Vitest e Playwright).",
            ]
          : [
              "Built the new checkout in React and Next.js, increasing conversion by 18%.",
              "Reduced order API response time from 900 ms to 250 ms with Redis caching.",
              "Implemented a CI/CD pipeline on GitHub Actions with automated tests (Vitest and Playwright).",
            ],
      },
      {
        company: "Agência Pixel",
        position: pt ? "Desenvolvedor Front-end" : "Front-end Developer",
        location: "Campinas, SP",
        startDate: "2020-06",
        endDate: "2022-02",
        current: false,
        highlights: pt
          ? [
              "Criei 12 sites institucionais responsivos com foco em acessibilidade (WCAG 2.1).",
              "Migrei 3 projetos legados de jQuery para TypeScript e React.",
            ]
          : [
              "Created 12 responsive corporate websites with a focus on accessibility (WCAG 2.1).",
              "Migrated 3 legacy projects from jQuery to TypeScript and React.",
            ],
      },
    ],
    education: [
      {
        institution: "Universidade Estadual de Campinas",
        area: pt ? "Ciência da Computação" : "Computer Science",
        studyType: pt ? "Bacharelado" : "Bachelor's degree",
        startDate: "2016-02",
        endDate: "2020-12",
      },
    ],
    skills: [
      { name: pt ? "Linguagens" : "Languages", keywords: ["TypeScript", "JavaScript", "Python", "SQL"] },
      { name: "Frameworks", keywords: ["React", "Next.js", "Node.js", "Express"] },
      { name: pt ? "Ferramentas" : "Tools", keywords: ["PostgreSQL", "Redis", "Docker", "Git", "GitHub Actions"] },
    ],
    projects: [
      {
        name: "cvlint",
        description: pt
          ? "Gerador de currículos e verificador ATS open source que roda 100% no navegador."
          : "Open-source resume builder and ATS checker that runs 100% in the browser.",
        url: "https://github.com/example/cvlint",
        highlights: [],
      },
    ],
    certificates: [{ name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", date: "2023-05", url: "" }],
    languages: pt
      ? [
          { language: "Português", fluency: "Nativo" },
          { language: "Inglês", fluency: "Avançado" },
        ]
      : [
          { language: "Portuguese", fluency: "Native" },
          { language: "English", fluency: "Advanced" },
        ],
  };
}
