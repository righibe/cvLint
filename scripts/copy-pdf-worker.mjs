// Copies the PDF.js worker that matches the installed pdfjs-dist version into
// public/, so it is served from our own origin (CSP: worker-src 'self'). The
// version is part of the file name: returning visitors never pair a new pdf.js
// API with a cached old worker.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = require.resolve("pdfjs-dist/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const src = join(dirname(pkgPath), "build", "pdf.worker.min.mjs");
const destDir = join(root, "public", "pdfjs");
const fileName = `pdf.worker.${version}.min.mjs`;

rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, fileName));
console.log(`${fileName} copied to public/pdfjs/`);
