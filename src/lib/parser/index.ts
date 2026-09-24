import { EMPTY_LAYOUT, type LayoutSignals } from "../ats/types";
import { normalizeText } from "../text/normalize";
import { extractDocx } from "./docx";
import { ParseError, toParseError } from "./errors";
import { LIMITS } from "./limits";
import { extractPdf, type PdfjsLike } from "./pdf";
import { detectFormat, type FileFormat } from "./sniff";
import { decodeTextFile } from "./txt";

export interface ParsedDocument {
  format: FileFormat;
  text: string;
  headerFooterText: string;
  layout: LayoutSignals;
  truncated: boolean;
}

export interface ParserDeps {
  loadPdfjs: () => Promise<PdfjsLike>;
}

export async function parseBytes(
  bytes: Uint8Array,
  fileName: string,
  deps: ParserDeps,
  signal?: AbortSignal,
): Promise<ParsedDocument> {
  if (bytes.length > LIMITS.maxFileBytes) throw new ParseError("too_large");
  const format = detectFormat(bytes, fileName);

  let raw = "";
  let headerFooterText = "";
  let layout: LayoutSignals = { ...EMPTY_LAYOUT };
  let truncated = false;

  if (format === "pdf") {
    const pdfjs = await deps.loadPdfjs();
    const pdf = await extractPdf(bytes, pdfjs, signal);
    raw = pdf.text;
    layout = { ...layout, columns: pdf.columns, pageCount: pdf.pageCount };
    truncated = pdf.pagesParsed < pdf.pageCount;
  } else if (format === "docx") {
    const docx = extractDocx(bytes);
    raw = docx.text;
    headerFooterText = normalizeText(docx.headerFooterText, 5_000).text;
    layout = { ...layout, ...docx.layout };
  } else {
    raw = decodeTextFile(bytes);
  }

  const normalized = normalizeText(raw);
  return {
    format,
    text: normalized.text,
    headerFooterText,
    layout,
    truncated: truncated || normalized.truncated,
  };
}

/** Browser entry point: size-checks before reading and enforces a wall-clock timeout. */
export async function parseFile(file: File, deps: ParserDeps): Promise<ParsedDocument> {
  if (file.size === 0) throw new ParseError("empty_file");
  if (file.size > LIMITS.maxFileBytes) throw new ParseError("too_large");

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ParseError("timeout"));
    }, LIMITS.parseTimeoutMs);
  });

  try {
    const work = file
      .arrayBuffer()
      .then((buffer) => parseBytes(new Uint8Array(buffer), file.name, deps, controller.signal));
    return await Promise.race([work, timeout]);
  } catch (error) {
    throw toParseError(error);
  } finally {
    clearTimeout(timer);
  }
}

export { ParseError } from "./errors";
export type { ParseErrorCode } from "./errors";
