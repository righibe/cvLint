import { ParseError } from "./errors";

/** Decodes a plain-text upload: UTF-16 by BOM, then UTF-8, then Windows-1252 as the common legacy fallback. */
export function decodeTextFile(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));

  // Without a UTF-16 BOM, NUL bytes never appear in real text files: it is binary content.
  if (bytes.includes(0)) throw new ParseError("invalid_text");

  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
