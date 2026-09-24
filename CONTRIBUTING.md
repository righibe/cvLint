# Contributing

Thanks for helping! Contributions in English or Portuguese are welcome.

1. Fork and create a branch.
2. `npm ci` (Node 24), then `npm run dev`.
3. Before opening a PR run `npm run check` and, for UI changes, `npm run build && npm run test:e2e`.

## Good first contributions

- **Skills, synonyms, verbs**: `src/lib/ats/lexicon.ts`. Add aliases in both languages; mark everyday words
  (like "Excel" or "Go") with `cs(...)` so only the exact casing counts. Add a test in `tests/unit/ats.test.ts`.
- **Translations**: `src/i18n/dictionaries/`. Both dictionaries must have the same keys and placeholders (a test enforces it).
- **Resume templates**: `src/components/builder/resume-document.tsx` and the `.resume` styles in `globals.css`.
  Templates must stay single-column and text-only, with real headings and lists.

## Rules

- No new runtime dependencies without discussion: every dependency is attack surface.
- No network calls, analytics or third-party scripts. Everything must keep working with the CSP in `src/lib/security/csp.ts`.
- No inline styles (`style={...}`) or HTML strings; the CSP and ESLint will reject them.
- Keep regexes linear (no nested quantifiers) and run them on bounded input.
