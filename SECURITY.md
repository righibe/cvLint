# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting
("Security" tab → "Report a vulnerability") with steps to reproduce. We aim to respond within 7 days.

## Threat model

cvlint has **no backend**: there are no API routes, server actions, database, accounts or third-party requests.
Resume files and job descriptions are processed entirely in the visitor's browser and stored only in their own
`localStorage` (builder data). This removes server-side upload attacks and data breaches by design, so the
remaining risks are client-side:

| Threat | Mitigation |
| --- | --- |
| XSS through parsed text, imported JSON or finding parameters | React text rendering only; `dangerouslySetInnerHTML`, `innerHTML` & co. are banned by ESLint; strict nonce CSP (no `unsafe-inline`, no `unsafe-eval`, `strict-dynamic`, `object-src 'none'`, `base-uri 'none'`) on **every** HTML response: the proxy matcher only skips exact static files, never depends on request headers, and `/_next/static` gets a `default-src 'none'` policy |
| Malicious links (`javascript:`, `data:`) in resume data | `toSafeUrl` allows only absolute `http(s)` URLs without credentials; every `href` goes through it; `rel="noopener noreferrer"` |
| `mailto:` header injection | email must match a conservative charset before a `mailto:` link is built |
| Malicious PDF exploiting the parser | pinned, audited pdf.js (6.x has no eval-based font path); font-face/WASM/XFA/worker-fetch disabled; worker served from our origin under `default-src 'none'; connect-src 'none'` so it cannot exfiltrate, with a versioned file name; worker destroyed after each file; 10-page, 20k-runs-per-page (streamed, cancelled at the cap) and 20 s limits |
| Zip bombs / huge DOCX | streaming unzip that inflates only the needed XML parts, in 16 KB slices, counting real output bytes (ZIP header sizes are never trusted); 4 MB document cap; entry-count cap. DOCX/TXT parsing is synchronous, so it is bounded by these size limits rather than by the timeout, and text is cut before Unicode normalization (NFKC can expand some characters 18x) |
| XML entity attacks (XXE, billion laughs) | no XML parser: a linear tokenizer reads `<w:t>` text and only decodes the five predefined entities and numeric references |
| ReDoS | regexes have no nested/overlapping quantifiers and run on bounded tokens or lines; adversarial-input tests enforce time budgets |
| Disguised files | format detected from magic bytes and must match the extension; legacy `.doc`, oversize (5 MB) and binary "text" files are rejected before parsing |
| Prototype pollution via imported JSON | `__proto__`/`constructor`/`prototype` keys dropped while parsing; zod strips unknown keys; size and item limits; lookup tables keyed by user text use `Object.hasOwn` |
| Trojan-source / spoofed text | bidi overrides, zero-width and control characters are stripped from parsed and imported text |
| Clickjacking, MIME sniffing, leaks via Referer | `frame-ancestors 'none'` + `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, COOP/CORP, restrictive `Permissions-Policy`, HSTS |
| Supply chain | exact versions + lockfile, `ignore-scripts=true` in `.npmrc` and `npm ci --ignore-scripts` in CI, `npm audit signatures`, `npm audit`, dependency review, Dependabot with a 5-day cooldown, CodeQL, GitHub Actions pinned to commit SHAs with read-only tokens |
| Resume data left on shared computers | data lives only in this browser's `localStorage`; "Save in this browser" can be switched off (nothing is stored) and "Clear all" deletes it |
| Cache poisoning of locale redirects | redirects carry `Cache-Control: private, no-store` and `Vary: Cookie, Accept-Language`; HTML is `no-store` |

## Out of scope

- Content that users choose to put in their own resume.
- Attacks that require a compromised browser, extension or device.
- Denial of service against the visitor's own tab by a file they choose to open (bounded by the limits above).
