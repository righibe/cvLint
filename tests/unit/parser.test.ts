import { strToU8, zipSync } from "fflate";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { decodeXmlEntities, detectDocxLayout, docxXmlToText, extractDocx } from "@/lib/parser/docx";
import { ParseError, toParseError } from "@/lib/parser/errors";
import { parseBytes, parseFile } from "@/lib/parser";
import { LIMITS } from "@/lib/parser/limits";
import { assemblePage, extractPdf, isDateLike, looksMultiColumn, type PdfjsLike } from "@/lib/parser/pdf";
import { detectFormat } from "@/lib/parser/sniff";
import { decodeTextFile } from "@/lib/parser/txt";
import { makeDocx, makePdf, makeStreamedDocx, para, simpleResumePdf, wordXml } from "../helpers/fixtures";

const lib = pdfjs as unknown as PdfjsLike;
const deps = { loadPdfjs: async () => lib };

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ParseError);
    expect((error as ParseError).code).toBe(code);
    return;
  }
  throw new Error(`expected ParseError(${code})`);
}

async function expectCodeAsync(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "ParseError", code });
}

describe("detectFormat", () => {
  const pdf = strToU8("%PDF-1.7\n...");
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);
  const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]);

  it("identifies formats by magic bytes, not by name", () => {
    expect(detectFormat(pdf, "cv.pdf")).toBe("pdf");
    expect(detectFormat(pdf, "CV.PDF")).toBe("pdf");
    expect(detectFormat(zip, "cv.docx")).toBe("docx");
    expect(detectFormat(strToU8("hello"), "cv.txt")).toBe("txt");
    expect(detectFormat(strToU8("hello"), "cv.md")).toBe("txt");
  });

  it("accepts a PDF header preceded by junk bytes", () => {
    expect(detectFormat(strToU8("\n\n  %PDF-1.4"), "a.pdf")).toBe("pdf");
  });

  it("rejects renamed or disguised files", () => {
    expectCode(() => detectFormat(pdf, "cv.docx"), "extension_mismatch");
    expectCode(() => detectFormat(pdf, "cv.txt"), "extension_mismatch");
    expectCode(() => detectFormat(zip, "cv.pdf"), "extension_mismatch");
    expectCode(() => detectFormat(strToU8("plain"), "cv.pdf"), "extension_mismatch");
    expectCode(() => detectFormat(zip, "archive.zip"), "extension_mismatch");
  });

  it("explains legacy .doc files", () => {
    expectCode(() => detectFormat(ole, "cv.doc"), "legacy_doc");
    expectCode(() => detectFormat(ole, "cv.docx"), "legacy_doc");
    expectCode(() => detectFormat(strToU8("x"), "cv.doc"), "legacy_doc");
  });

  it("rejects empty and unknown files", () => {
    expectCode(() => detectFormat(new Uint8Array(), "cv.pdf"), "empty_file");
    expectCode(() => detectFormat(strToU8("MZ..."), "setup.exe"), "unsupported_type");
    expectCode(() => detectFormat(strToU8("x"), "noextension"), "unsupported_type");
  });
});

describe("decodeTextFile", () => {
  it("decodes UTF-8 with or without BOM", () => {
    expect(decodeTextFile(strToU8("Experiência"))).toBe("Experiência");
    expect(decodeTextFile(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe("A");
  });

  it("falls back to Windows-1252 for legacy encodings", () => {
    expect(decodeTextFile(new Uint8Array([0x45, 0x78, 0x70, 0xea]))).toBe("Expê");
  });

  it("rejects binary content", () => {
    expectCode(() => decodeTextFile(new Uint8Array([0x41, 0x00, 0x42])), "invalid_text");
  });
});

describe("DOCX extraction", () => {
  it("extracts paragraphs, tabs, breaks and decodes entities", () => {
    const xml = wordXml(
      para("Jane Doe") +
        `<w:p><w:r><w:t>A &amp; B</w:t><w:tab/><w:t>C&#233;&#x20AC;</w:t><w:br/><w:t>next</w:t></w:r></w:p>`,
    );
    expect(docxXmlToText(xml)).toBe("Jane Doe\nA & B\tCé€\nnext\n");
  });

  it("ignores tab-stop definitions, deleted text and field codes", () => {
    const xml = wordXml(
      `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:t>Hello</w:t></w:r>` +
        `<w:r><w:delText>gone</w:delText><w:instrText>HYPERLINK x</w:instrText></w:r></w:p>`,
    );
    expect(docxXmlToText(xml)).toBe("Hello\n");
  });

  it("reads text boxes once (skips the mc:Fallback copy)", () => {
    const box = `<w:txbxContent>${para("Boxed")}</w:txbxContent>`;
    const xml = wordXml(
      `<w:p><w:r><mc:AlternateContent><mc:Choice>${box}</mc:Choice><mc:Fallback>${box}</mc:Fallback></mc:AlternateContent></w:r></w:p>`,
    );
    expect(docxXmlToText(xml).match(/Boxed/g)).toHaveLength(1);
  });

  it("drops invalid numeric entities instead of producing broken strings", () => {
    expect(decodeXmlEntities("a&#0;b&#xD800;c&#1114112;d&bogus;")).toBe("abcd&bogus;");
  });

  it("detects ATS-hostile layout", () => {
    const xml = wordXml(`<w:tbl><w:tr><w:tc>${para("x")}</w:tc></w:tr></w:tbl><w:txbxContent/><w:sectPr><w:cols w:num="2"/></w:sectPr>`);
    expect(detectDocxLayout(xml, 1)).toEqual({ tables: 1, textBoxes: 1, images: 1, columns: true });
    expect(detectDocxLayout(wordXml(`<w:cols w:num="1"/>`), 0).columns).toBe(false);
  });

  it("extracts a full document with header text and media", () => {
    const bytes = makeDocx({
      "word/document.xml": wordXml(para("Experience") + para("Built things")),
      "word/header1.xml": `<w:hdr>${para("jane@example.com")}</w:hdr>`,
      "word/media/image1.png": new Uint8Array([1, 2, 3]),
    });
    const result = extractDocx(bytes);
    expect(result.text).toContain("Built things");
    expect(result.headerFooterText).toContain("jane@example.com");
    expect(result.layout.images).toBe(1);
  });

  it("handles entries written with data descriptors (streamed ZIP)", async () => {
    const bytes = await makeStreamedDocx({ "word/document.xml": wordXml(para("Streamed résumé")) });
    expect(extractDocx(bytes).text).toContain("Streamed résumé");
  });

  it("rejects decompression bombs without inflating them fully", () => {
    const bomb = zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/document.xml": new Uint8Array(LIMITS.docx.maxDocumentXmlBytes + 1024 * 1024),
    });
    expect(bomb.length).toBeLessThan(200_000);
    expectCode(() => extractDocx(bomb), "zip_bomb");
  });

  it("rejects archives with too many entries", () => {
    const files: Record<string, Uint8Array> = { "[Content_Types].xml": strToU8("<Types/>") };
    for (let i = 0; i <= LIMITS.docx.maxEntries; i += 1) files[`junk/${i}.txt`] = new Uint8Array(1);
    expectCode(() => extractDocx(zipSync(files, { level: 0 })), "zip_bomb");
  });

  it("rejects ZIPs that are not Word documents", () => {
    expectCode(() => extractDocx(zipSync({ "hello.txt": strToU8("hi") })), "invalid_docx");
    expectCode(() => extractDocx(zipSync({ "word/document.xml": strToU8(wordXml("")) })), "invalid_docx");
    expectCode(() => extractDocx(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8])), "invalid_docx");
  });

  it("stays linear on hostile markup", () => {
    const hostile = "<".repeat(300_000) + "&#".repeat(100_000);
    const started = performance.now();
    docxXmlToText(hostile);
    detectDocxLayout(`<w:cols ${"a".repeat(300_000)}`, 0);
    expect(performance.now() - started).toBeLessThan(1_500);
  });
});

describe("PDF line assembly", () => {
  const run = (str: string, x: number, y: number, width = str.length * 5) => ({ str, x, y, width, height: 10 });

  it("groups runs into lines and restores spaces from gaps", () => {
    const page = assemblePage([run("World", 90, 700), run("Hello", 50, 700), run("Next line", 50, 684)], 612);
    expect(page.lines).toEqual(["Hello World", "Next line"]);
  });

  it("does not insert spaces inside tightly kerned words", () => {
    const page = assemblePage([run("Exper", 50, 700, 25), run("ience", 75, 700, 25)], 612);
    expect(page.lines).toEqual(["Experience"]);
  });

  it("flags side-by-side prose blocks as columns but not right-aligned dates", () => {
    const columns = assemblePage(
      Array.from({ length: 10 }, (_, i) => [run("Built a payments service", 40, 700 - i * 14), run("Python Django and PostgreSQL daily", 330, 700 - i * 14)]).flat(),
      612,
    );
    expect(columns.splitLines).toBe(10);
    expect(looksMultiColumn([columns])).toBe(true);

    const dated = assemblePage(
      Array.from({ length: 10 }, (_, i) => [run("Senior Engineer at Company", 40, 700 - i * 14), run("Jan 2020 – Present", 480, 700 - i * 14)]).flat(),
      612,
    );
    expect(dated.splitLines).toBe(0);
    expect(looksMultiColumn([dated])).toBe(false);
  });

  it("recognizes date-only segments", () => {
    for (const s of ["Jan 2020 – Present", "03/2019 - 12/2021", "2018 – 2020", "mar. 2021 - atual", "Set 2022 – Hoje"]) {
      expect(isDateLike(s), s).toBe(true);
    }
    for (const s of ["Python and Django", "", "2020 was a great year for sales", "1".repeat(50)]) {
      expect(isDateLike(s), s).toBe(false);
    }
  });

  it("needs enough evidence before calling it multi-column", () => {
    expect(looksMultiColumn([{ lines: ["a", "b"], splitLines: 2, rightStartLines: 0 }])).toBe(false);
  });
});

describe("PDF extraction (pdf.js)", () => {
  it("extracts ordered text from a single-column PDF", async () => {
    const pdf = simpleResumePdf(["Jane Doe", "jane@example.com", "Experiência", "Built (and shipped) things"]);
    const result = await extractPdf(pdf, lib);
    expect(result.text.split("\n")).toEqual(["Jane Doe", "jane@example.com", "Experiência", "Built (and shipped) things"]);
    expect(result.pageCount).toBe(1);
    expect(result.columns).toBe(false);
  });

  it("detects a two-column layout", async () => {
    const lines = Array.from({ length: 12 }, (_, i) => [
      { x: 40, y: 740 - i * 16, text: "Led migration of the billing platform" },
      { x: 330, y: 740 - i * 16, text: "TypeScript React Node.js and Docker" },
    ]).flat();
    const result = await extractPdf(makePdf([lines]), lib);
    expect(result.columns).toBe(true);
  });

  it("only parses up to the page limit", async () => {
    const pages = Array.from({ length: LIMITS.maxPdfPages + 2 }, (_, i) => [{ x: 50, y: 700, text: `Page ${i + 1}` }]);
    const result = await extractPdf(makePdf(pages), lib);
    expect(result.pageCount).toBe(LIMITS.maxPdfPages + 2);
    expect(result.pagesParsed).toBe(LIMITS.maxPdfPages);
    expect(result.text).not.toContain(`Page ${LIMITS.maxPdfPages + 1}`);
  });

  it("maps broken PDFs to invalid_pdf", async () => {
    await expectCodeAsync(extractPdf(strToU8("%PDF-1.4\ngarbage without objects"), lib), "invalid_pdf");
  });

  it("maps an aborted parse to timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    await expectCodeAsync(extractPdf(simpleResumePdf(["x"]), lib, controller.signal), "timeout");
  });
});

describe("parseBytes / parseFile", () => {
  it("parses each supported format into normalized text", async () => {
    const txt = await parseBytes(strToU8("  Jane\r\n\r\n\r\nDoe ‮ "), "cv.txt", deps);
    expect(txt).toMatchObject({ format: "txt", text: "Jane\n\nDoe", truncated: false });

    const docx = await parseBytes(makeDocx({ "word/document.xml": wordXml(para("Hello") + "<w:tbl/>") }), "cv.docx", deps);
    expect(docx.format).toBe("docx");
    expect(docx.text).toBe("Hello");

    const pdf = await parseBytes(simpleResumePdf(["Hello PDF"]), "cv.pdf", deps);
    expect(pdf).toMatchObject({ format: "pdf", text: "Hello PDF" });
    expect(pdf.layout.pageCount).toBe(1);
  });

  it("marks truncated output", async () => {
    const txt = await parseBytes(strToU8("word ".repeat(20_000)), "cv.txt", deps);
    expect(txt.truncated).toBe(true);
  });

  it("enforces the size limit before reading the file", async () => {
    const big = new File([new Uint8Array(LIMITS.maxFileBytes + 1)], "cv.pdf");
    await expectCodeAsync(parseFile(big, deps), "too_large");
    await expectCodeAsync(parseFile(new File([], "cv.pdf"), deps), "empty_file");
    await expectCodeAsync(parseBytes(new Uint8Array(LIMITS.maxFileBytes + 1), "cv.pdf", deps), "too_large");
  });

  it("parses a File end to end", async () => {
    const file = new File([simpleResumePdf(["From a File"])], "cv.pdf", { type: "application/pdf" });
    const doc = await parseFile(file, deps);
    expect(doc.text).toBe("From a File");
  });

  it("wraps unexpected errors", () => {
    expect(toParseError(new Error("boom")).code).toBe("unknown");
    expect(toParseError("weird").code).toBe("unknown");
    const known = new ParseError("timeout");
    expect(toParseError(known)).toBe(known);
  });
});
