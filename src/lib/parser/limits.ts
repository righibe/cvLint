export const LIMITS = {
  /** Largest file accepted, checked before any byte is read. */
  maxFileBytes: 5 * 1024 * 1024,
  maxPdfPages: 10,
  /** Text runs read per PDF page; real resume pages have a few hundred. */
  maxPdfItemsPerPage: 20_000,
  /**
   * Wall-clock limit for PDF parsing (pdf.js work happens in its worker, which is
   * destroyed on timeout). DOCX/TXT parsing is synchronous and is bounded by the
   * size limits instead.
   */
  parseTimeoutMs: 20_000,
  docx: {
    maxEntries: 2_000,
    /** Decompressed size cap for word/document.xml (text-heavy 10-page resumes are < 1 MB). */
    maxDocumentXmlBytes: 4 * 1024 * 1024,
    /** Decompressed size cap for each header/footer part. */
    maxPartXmlBytes: 1 * 1024 * 1024,
    maxHeaderFooterParts: 12,
  },
} as const;
