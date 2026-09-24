import { strToU8, Zip, ZipDeflate, zipSync, type Zippable } from "fflate";

export interface PdfLine {
  x: number;
  y: number;
  text: string;
  size?: number;
}

function pdfString(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (code < 32 || code > 126) out += `\\${(code & 0xff).toString(8).padStart(3, "0")}`;
    else out += ch;
  }
  return `(${out})`;
}

/** Builds a small, valid PDF (Helvetica, WinAnsi) with text at exact positions. */
export function makePdf(pages: PdfLine[][], width = 612, height = 792): Uint8Array<ArrayBuffer> {
  const objects: string[] = [];
  const pageIds: number[] = [];
  // 1: catalog, 2: pages, 3: font; pages and contents follow.
  const firstPageId = 4;
  pages.forEach((_, i) => pageIds.push(firstPageId + i * 2));

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  pages.forEach((lines, i) => {
    const pageId = firstPageId + i * 2;
    const contentId = pageId + 1;
    const stream = lines
      .map((l) => `BT /F1 ${l.size ?? 11} Tf 1 0 0 1 ${l.x} ${l.y} Tm ${pdfString(l.text)} Tj ET`)
      .join("\n");
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i += 1) bytes[i] = body.charCodeAt(i) & 0xff;
  return bytes;
}

/** Single-column resume page: one line per entry, top to bottom. */
export function simpleResumePdf(lines: string[]): Uint8Array<ArrayBuffer> {
  return makePdf([lines.map((text, i) => ({ x: 56, y: 740 - i * 16, text }))]);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`;

export function wordXml(bodyXml: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`
  );
}

export const para = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

export function makeDocx(files: Record<string, string | Uint8Array>): Uint8Array {
  const zippable: Zippable = { "[Content_Types].xml": strToU8(CONTENT_TYPES) };
  for (const [name, content] of Object.entries(files)) zippable[name] = typeof content === "string" ? strToU8(content) : content;
  return zipSync(zippable);
}

/** Same as makeDocx but written with the streaming encoder (entries use data descriptors). */
export function makeStreamedDocx(files: Record<string, string>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((err, chunk, final) => {
      if (err) return reject(err);
      chunks.push(chunk);
      if (final) {
        const total = chunks.reduce((n, c) => n + c.length, 0);
        const out = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          out.set(c, offset);
          offset += c.length;
        }
        resolve(out);
      }
    });
    for (const [name, content] of Object.entries({ "[Content_Types].xml": CONTENT_TYPES, ...files })) {
      const entry = new ZipDeflate(name, { level: 6 });
      zip.add(entry);
      entry.push(strToU8(content), true);
    }
    zip.end();
  });
}
