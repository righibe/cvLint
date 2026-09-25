# cvlint

A linter for your resume. Made by [Bernardo Righi](https://righi.dev).

Open-source, privacy-first **resume builder + ATS checker**, in **English and Portuguese**.
Everything runs in the browser: no database, no AI tokens, no tracking. Self-hosted with Docker on a small VPS.

> 🇧🇷 [Leia em português](#português)

## Features

- **ATS checker**: upload a PDF, DOCX or TXT (or paste text) and see:
  - the exact text an ATS extracts ("What the ATS reads")
  - layout problems: tables, text boxes, multi-column layouts, icon fonts, contact info in headers/footers, page count
  - standard sections (EN/PT), including headings hidden behind icon glyphs ("l EXPERIENCE")
  - contact data written as text (email, phone, LinkedIn URL vs. a hidden link)
  - content signals: metrics, action verbs (EN/PT, STAR-style too), bullets, dates
  - keyword match against a job description, with a bilingual skill dictionary
    ("machine learning" ↔ "aprendizado de máquina") and case-aware matching for ambiguous words ("Excel" vs "excel at")
- **Resume builder**: form → single-column, text-based, ATS-friendly resume. Two templates, EN/PT headings,
  print to PDF, JSON export, import of cvlint or [JSON Resume](https://jsonresume.org) files, autosave to `localStorage`.

## How the score works

Rule-based and transparent (see `src/lib/ats/analyze.ts`). Each category is 0–100 and weighted:

| Category     | With job | Without job |
| ------------ | -------- | ----------- |
| Keywords     | 35%      | –           |
| Parseability | 25%      | 35%         |
| Sections     | 15%      | 25%         |
| Content      | 15%      | 25%         |
| Contact      | 10%      | 15%         |

It is an estimate of common ATS parsing problems, not a prediction of any specific vendor.

## Architecture

```
src/
  proxy.ts                 locale redirect + per-request CSP nonce (Next.js 16 "proxy")
  app/[locale]/            pages (home, checker, builder), rendered per request for the nonce
  components/              UI (checker and builder are client-only)
  i18n/                    locales, negotiation, EN/PT dictionaries
  lib/parser/              file sniffing, PDF (pdf.js), DOCX (streaming unzip), TXT
  lib/ats/                 tokenizer-based scoring engine (pure functions)
  lib/resume/              schema (zod), import/export, storage, plain-text rendering
  lib/security/csp.ts      Content-Security-Policy builder
tests/unit                 Vitest (parser, engine, schema, i18n, CSP)
tests/e2e                  Playwright against the production build (real CSP)
```

## Security

See [SECURITY.md](SECURITY.md) for the threat model. Highlights: files never leave the browser; strict nonce-based CSP
without `unsafe-inline`/`unsafe-eval`; the PDF.js worker runs under its own `default-src 'none'` policy; magic-byte
file detection; zip-bomb and entry-count limits for DOCX; linear-time regexes; only `http(s)` links ever reach an `href`;
prototype-pollution-safe JSON import; pinned GitHub Actions, `npm ci --ignore-scripts`, `npm audit signatures`,
CodeQL and dependency review in CI.

## Development

Requires Node.js 24 (see `.nvmrc`).

```bash
npm ci
npm run dev          # http://localhost:3000
npm run check        # lint + typecheck + unit tests
npm run build && npm run test:e2e   # Playwright (run `npx playwright install chromium` once)
```

## Deploy (VPS + Docker)

```bash
cp .env.example .env   # set SITE_DOMAIN and NEXT_PUBLIC_SITE_URL
docker compose up -d --build
```

Caddy terminates HTTPS automatically; the app container runs as non-root on a read-only filesystem with no internet
access. Full guide: [docs/DEPLOY.md](docs/DEPLOY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New skills, section synonyms and action verbs live in `src/lib/ats/lexicon.ts`.

## Author

Built by **Bernardo Righi** — portfolio: [righi.dev](https://righi.dev).

## License

[MIT](LICENSE)

---

## Português

**Gerador de currículo + verificador ATS** open source e privado, em **português e inglês**. Tudo roda no navegador:
sem banco de dados, sem tokens de IA, sem rastreamento. Roda com Docker numa VPS pequena.

### O que faz

- **Verificador ATS**: envie PDF, DOCX ou TXT (ou cole o texto) e veja o texto exato que o ATS extrai, problemas de
  layout (tabelas, caixas de texto, colunas, fontes de ícones, contatos no cabeçalho), seções padrão, contatos,
  métricas, verbos de ação, datas e a comparação de palavras-chave com a vaga — com dicionário bilíngue de habilidades.
- **Gerador de currículo**: formulário → currículo de coluna única, baseado em texto e amigável para ATS. Dois modelos,
  títulos em PT/EN, impressão em PDF, exportação JSON, importação de cvlint ou JSON Resume, salvamento automático local.

### Rodando localmente

```bash
npm ci
npm run dev          # http://localhost:3000
npm run check        # lint + tipos + testes unitários
npm run build && npm run test:e2e
```

### Deploy (VPS + Docker)

Copie `.env.example` para `.env`, ajuste o domínio e rode `docker compose up -d --build`. O Caddy cuida do HTTPS
automaticamente. Guia completo: [docs/DEPLOY.md](docs/DEPLOY.md).

### Segurança

Veja o [SECURITY.md](SECURITY.md). Os arquivos nunca saem do navegador, a CSP é estrita com nonce, os uploads são
validados por assinatura binária, há proteção contra zip bomb e ReDoS, e só links `http(s)` chegam a um `href`.
