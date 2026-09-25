# Contributing

Thanks for helping! Contributions in English or Portuguese are welcome, and first-time contributors especially.

> 🇧🇷 [Versão em português abaixo](#português)

## Your first contribution in 6 steps

1. Pick an issue labeled [`good first issue`](https://github.com/righibe/cvLint/labels/good%20first%20issue) and
   comment that you are taking it (so two people don't do the same work).
2. Fork the repository and create a branch: `git checkout -b add-skill-flutter`.
3. Install and run (Node.js 24, see `.nvmrc`):
   ```bash
   npm ci
   npm run dev      # http://localhost:3000
   ```
4. Make your change and add a test next to similar ones in `tests/unit/`.
5. Check everything passes: `npm run check` (lint + types + unit tests).
6. Open a pull request describing **what** changed and **why**. CI runs automatically.

## Where things live

| I want to…                              | Edit                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------- |
| add a skill or an alias (EN/PT)         | `src/lib/ats/lexicon.ts` → `SKILLS`                                        |
| add a section heading synonym           | `src/lib/ats/lexicon.ts` → `SECTION_SYNONYMS` / `NONSTANDARD_HEADINGS`     |
| add an action verb                      | `src/lib/ats/lexicon.ts` → `ACTION_VERBS`                                  |
| improve a message or translation        | `src/i18n/dictionaries/en.ts` and `pt.ts` (same keys in both)              |
| change a resume template                | `src/components/builder/resume-document.tsx` + `.resume` in `globals.css`  |
| change how the score is computed        | `src/lib/ats/analyze.ts` (open an issue first to discuss)                  |

### Example: adding a skill

```ts
// src/lib/ats/lexicon.ts
s("Flutter", "flutter sdk"),
```

Everyday words that are also skill names ("Excel", "Go", "Spring") use `cs(...)`, so only the exact casing counts.
Then add a test, for example in `tests/unit/ats.test.ts`:

```ts
const terms = extractJobKeywords("Requirements: Flutter").map((k) => k.term);
expect(terms).toContain("Flutter");
```

## Rules

- No new runtime dependencies without discussion: every dependency is attack surface.
- No network calls, analytics or third-party scripts. Everything must keep working with the CSP in `src/lib/security/csp.ts`.
- No inline styles (`style={...}`) or HTML strings; the CSP and ESLint will reject them.
- Keep regexes linear (no nested quantifiers) and run them on bounded input.
- Never commit real resumes or personal data as test fixtures; generate fictional ones in code.

---

## Português

Obrigado por ajudar! Contribuições em português ou inglês são bem-vindas, principalmente de quem está fazendo a primeira.

### Sua primeira contribuição em 6 passos

1. Escolha uma issue com a etiqueta [`good first issue`](https://github.com/righibe/cvLint/labels/good%20first%20issue)
   e comente que vai pegá-la (assim duas pessoas não fazem a mesma coisa).
2. Faça um fork e crie uma branch: `git checkout -b adiciona-skill-flutter`.
3. Instale e rode (Node.js 24, veja o `.nvmrc`):
   ```bash
   npm ci
   npm run dev      # http://localhost:3000
   ```
4. Faça a alteração e adicione um teste perto dos parecidos em `tests/unit/`.
5. Confira que tudo passa: `npm run check` (lint + tipos + testes).
6. Abra o pull request explicando **o que** mudou e **por quê**. A CI roda sozinha.

A tabela "Where things live" acima mostra onde fica cada coisa: habilidades, sinônimos de seção e verbos em
`src/lib/ats/lexicon.ts`; textos e traduções em `src/i18n/dictionaries/`; modelos de currículo em
`src/components/builder/resume-document.tsx`.

### Regras

- Nada de dependência nova em produção sem discutir antes: cada dependência é superfície de ataque.
- Nada de chamadas de rede, analytics ou scripts de terceiros.
- Nada de estilo inline (`style={...}`) nem HTML em string; a CSP e o ESLint rejeitam.
- Regex sempre linear (sem quantificadores aninhados) e rodando em entrada limitada.
- Nunca use currículos reais ou dados pessoais nos testes; gere dados fictícios no código.
