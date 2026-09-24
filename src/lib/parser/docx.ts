import { Unzip, UnzipInflate, type UnzipFile } from "fflate";
import { ParseError } from "./errors";
import { LIMITS } from "./limits";

export interface DocxLayout {
  tables: number;
  textBoxes: number;
  images: number;
  columns: boolean;
}

export interface DocxResult {
  text: string;
  headerFooterText: string;
  layout: DocxLayout;
}

const DOCUMENT_PART = /^word\/document\d*\.xml$/;
const HEADER_FOOTER_PART = /^word\/(?:header|footer)\d*\.xml$/;
const MEDIA_PART = /^word\/media\/[^/]+$/;
/** Input is fed to the inflater in small slices so a single slice can never expand past ~16 MB. */
const PUSH_CHUNK_BYTES = 16 * 1024;

interface CollectedPart {
  chunks: Uint8Array[];
  bytes: number;
  done: boolean;
}

function concat(part: CollectedPart): Uint8Array {
  const out = new Uint8Array(part.bytes);
  let offset = 0;
  for (const chunk of part.chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Streams the ZIP container and only inflates the XML parts we need, counting
 * decompressed bytes as they are produced. Declared sizes in ZIP headers are
 * attacker-controlled, so they are never trusted for allocation.
 */
function readDocxParts(bytes: Uint8Array) {
  let entries = 0;
  let images = 0;
  let hasContentTypes = false;
  let documentPart: CollectedPart | null = null;
  const headerFooterParts: CollectedPart[] = [];
  // fflate catches exceptions thrown from ondata and calls ondata again with the
  // error, so the first failure is remembered and re-thrown as-is.
  let failure: ParseError | null = null;

  const collect = (file: UnzipFile, maxBytes: number): CollectedPart => {
    const part: CollectedPart = { chunks: [], bytes: 0, done: false };
    file.ondata = (err, data, final) => {
      if (failure) throw failure;
      if (err) {
        const cause: unknown = err;
        failure = cause instanceof ParseError ? cause : new ParseError("invalid_docx", err.message);
        throw failure;
      }
      part.bytes += data.length;
      if (part.bytes > maxBytes) {
        failure = new ParseError("zip_bomb", file.name);
        throw failure;
      }
      part.chunks.push(data);
      if (final) part.done = true;
    };
    file.start();
    return part;
  };

  const unzip = new Unzip((file) => {
    entries += 1;
    if (entries > LIMITS.docx.maxEntries) throw new ParseError("zip_bomb", "too many entries");

    const name = file.name;
    if (name === "[Content_Types].xml") hasContentTypes = true;

    if (documentPart === null && DOCUMENT_PART.test(name)) {
      documentPart = collect(file, LIMITS.docx.maxDocumentXmlBytes);
    } else if (HEADER_FOOTER_PART.test(name) && headerFooterParts.length < LIMITS.docx.maxHeaderFooterParts) {
      headerFooterParts.push(collect(file, LIMITS.docx.maxPartXmlBytes));
    } else if (MEDIA_PART.test(name)) {
      images += 1;
    }
  });
  unzip.register(UnzipInflate);

  try {
    for (let offset = 0; offset < bytes.length; offset += PUSH_CHUNK_BYTES) {
      const end = Math.min(offset + PUSH_CHUNK_BYTES, bytes.length);
      unzip.push(bytes.subarray(offset, end), end === bytes.length);
    }
  } catch (error) {
    if (failure) throw failure;
    if (error instanceof ParseError) throw error;
    throw new ParseError("invalid_docx", error instanceof Error ? error.message : undefined);
  }
  if (failure) throw failure;

  const doc = documentPart as CollectedPart | null;
  if (!hasContentTypes || doc === null || !doc.done) throw new ParseError("invalid_docx", "missing document part");

  return {
    documentXml: concat(doc),
    headerFooterXml: headerFooterParts.filter((p) => p.done).map(concat),
    images,
  };
}

const NAMED_ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

export function decodeXmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|lt|gt|amp|quot|apos);/g, (match, entity: string) => {
    if (entity[0] !== "#") return NAMED_ENTITIES[entity] ?? match;
    const code = entity[1] === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
    return valid ? String.fromCodePoint(code) : "";
  });
}

/**
 * Extracts visible text from WordprocessingML without an XML parser: no DTDs,
 * no entity expansion, no external references. The tokenizer regex is linear
 * (tags cannot contain "<"), so malformed input cannot trigger backtracking.
 */
export function docxXmlToText(xml: string): string {
  const out: string[] = [];
  let inText = false;
  let runDepth = 0;
  // Word stores text boxes twice (mc:Choice + legacy mc:Fallback); read only one copy.
  let fallbackDepth = 0;

  for (const match of xml.matchAll(/<[^<>]*>|[^<]+|</g)) {
    const token = match[0];
    if (token[0] !== "<") {
      if (inText && fallbackDepth === 0) out.push(decodeXmlEntities(token));
      continue;
    }
    if (token.length < 3 || token[1] === "?" || token[1] === "!") continue;

    const closing = token[1] === "/";
    const selfClosing = token.endsWith("/>");
    const name = /^<\/?([\w:.-]+)/.exec(token)?.[1];

    if (name === "mc:Fallback" && !selfClosing) {
      fallbackDepth = Math.max(0, fallbackDepth + (closing ? -1 : 1));
      continue;
    }
    if (fallbackDepth > 0) continue;

    switch (name) {
      case "w:r":
        if (!selfClosing) runDepth = Math.max(0, runDepth + (closing ? -1 : 1));
        break;
      case "w:t":
        inText = !closing && !selfClosing;
        break;
      case "w:tab":
        if (!closing && runDepth > 0) out.push("\t");
        break;
      case "w:noBreakHyphen":
        if (!closing && runDepth > 0) out.push("-");
        break;
      case "w:br":
      case "w:cr":
        if (!closing && runDepth > 0) out.push("\n");
        break;
      case "w:p":
        if (closing || selfClosing) out.push("\n");
        break;
      case "w:tc":
        if (closing) out.push("\t");
        break;
    }
  }
  return out.join("");
}

/** Same linear tag scan as the text extractor, skipping the mc:Fallback duplicates. */
export function detectDocxLayout(xml: string, images: number): DocxLayout {
  const layout: DocxLayout = { tables: 0, textBoxes: 0, images, columns: false };
  let fallbackDepth = 0;

  for (const match of xml.matchAll(/<[^<>]*>/g)) {
    const token = match[0];
    const closing = token[1] === "/";
    const name = /^<\/?([\w:.-]+)/.exec(token)?.[1];
    if (name === "mc:Fallback" && !token.endsWith("/>")) {
      fallbackDepth = Math.max(0, fallbackDepth + (closing ? -1 : 1));
      continue;
    }
    if (closing || fallbackDepth > 0) continue;
    if (name === "w:tbl") layout.tables += 1;
    else if (name === "w:txbxContent") layout.textBoxes += 1;
    else if (name === "w:cols" && Number(/\bw:num="(\d{1,3})"/.exec(token)?.[1] ?? 1) > 1) layout.columns = true;
  }
  return layout;
}

export function extractDocx(bytes: Uint8Array): DocxResult {
  const parts = readDocxParts(bytes);
  const decoder = new TextDecoder("utf-8");
  const documentXml = decoder.decode(parts.documentXml);

  return {
    text: docxXmlToText(documentXml),
    headerFooterText: parts.headerFooterXml.map((xml) => docxXmlToText(decoder.decode(xml))).join("\n"),
    layout: detectDocxLayout(documentXml, parts.images),
  };
}
