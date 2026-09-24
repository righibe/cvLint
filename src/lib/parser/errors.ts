export const PARSE_ERROR_CODES = [
  "empty_file",
  "too_large",
  "unsupported_type",
  "legacy_doc",
  "extension_mismatch",
  "invalid_pdf",
  "encrypted_pdf",
  "invalid_docx",
  "zip_bomb",
  "invalid_text",
  "no_text",
  "timeout",
  "unknown",
] as const;

export type ParseErrorCode = (typeof PARSE_ERROR_CODES)[number];

export class ParseError extends Error {
  readonly code: ParseErrorCode;

  constructor(code: ParseErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ParseError";
    this.code = code;
  }
}

export function toParseError(error: unknown): ParseError {
  if (error instanceof ParseError) return error;
  return new ParseError("unknown", error instanceof Error ? error.message : undefined);
}
