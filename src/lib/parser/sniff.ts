import { ParseError } from "./errors";

export type FileFormat = "pdf" | "docx" | "txt";

const EXTENSIONS: Record<string, FileFormat> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "txt",
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, i) => bytes[offset + i] === value);
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/**
 * Decides the real format from magic bytes, never trusting the file name or the
 * browser-provided MIME type alone. The extension must agree with the content.
 */
export function detectFormat(bytes: Uint8Array, fileName: string): FileFormat {
  if (bytes.length === 0) throw new ParseError("empty_file");

  const ext = extensionOf(fileName);
  const claimed = EXTENSIONS[ext];

  // OLE2 compound file: legacy .doc (Word 97-2003).
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    throw new ParseError("legacy_doc");
  }

  // PDF header may be preceded by junk; the spec tolerates it within the first 1024 bytes.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (head.includes("%PDF-")) {
    // A missing extension is fine (the content decides); a conflicting one is not.
    if (claimed !== "pdf" && ext !== "") throw new ParseError("extension_mismatch");
    return "pdf";
  }

  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // A modern Word file saved with a ".doc" name is still a DOCX package.
    if (claimed !== "docx" && ext !== "" && ext !== "doc") throw new ParseError("extension_mismatch");
    return "docx";
  }

  if (claimed === "pdf" || claimed === "docx") throw new ParseError("extension_mismatch");
  if (claimed === "txt") return "txt";
  if (ext === "doc") throw new ParseError("legacy_doc");
  throw new ParseError("unsupported_type");
}
