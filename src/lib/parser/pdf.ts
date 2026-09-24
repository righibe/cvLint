import type { getDocument as GetDocument } from "pdfjs-dist";
import { fold } from "../text/normalize";
import { ParseError } from "./errors";
import { LIMITS } from "./limits";

export interface PdfjsLike {
  getDocument: typeof GetDocument;
}

export interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfResult {
  text: string;
  pageCount: number;
  pagesParsed: number;
  columns: boolean;
}

const MONTH_PREFIXES = ["jan", "feb", "fev", "mar", "apr", "abr", "may", "mai", "jun", "jul", "aug", "ago", "sep", "set", "oct", "out", "nov", "dec", "dez"];
const ONGOING_WORDS = new Set(["present", "current", "now", "today", "atual", "atualmente", "hoje", "presente"]);

/** Right-hand parts that are only a date (e.g. "Jan 2020 – Present") are normal single-column layout. */
export function isDateLike(segment: string): boolean {
  if (segment.length > 40) return false;
  const tokens = fold(segment).split(/[\s/.,–—-]+/).filter(Boolean);
  return (
    tokens.length > 0 &&
    tokens.every(
      (t) =>
        /^\d{1,4}$/.test(t) ||
        ONGOING_WORDS.has(t) ||
        (t.length <= 9 && MONTH_PREFIXES.some((m) => t.startsWith(m))),
    )
  );
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

export interface AssembledPage {
  lines: string[];
  /** Lines made of two wide-apart blocks of prose (typical of side-by-side columns). */
  splitLines: number;
  /** Lines that start in the right part of the page (a right column on its own line). */
  rightStartLines: number;
}

/** Rebuilds reading-order lines from positioned PDF text runs. */
export function assemblePage(items: PositionedText[], pageWidth: number): AssembledPage {
  const runs = items.filter((i) => i.str.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PositionedText[][] = [];

  for (const run of runs) {
    const row = rows[rows.length - 1];
    const anchor = row?.[0];
    // Larger height: a superscript ("1st") must stay on its base line.
    const tolerance = Math.max(2, Math.max(run.height || 10, anchor?.height || 10) * 0.5);
    if (row && anchor && Math.abs(anchor.y - run.y) <= tolerance) row.push(run);
    else rows.push([run]);
  }

  const bigGap = pageWidth * 0.06;
  const lines: string[] = [];
  let splitLines = 0;
  let rightStartLines = 0;

  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const segments: string[] = [];
    let current = "";
    let prev: PositionedText | null = null;

    for (const run of row) {
      // "Fake bold": the same text drawn twice with a tiny offset.
      if (prev && run.str === prev.str && Math.abs(run.x - prev.x) < 2) continue;
      if (prev) {
        const gap = run.x - (prev.x + prev.width);
        const charWidth = prev.width / Math.max(prev.str.length, 1);
        if (gap > bigGap) {
          segments.push(current);
          current = "";
        } else if (gap > charWidth * 0.2 && !current.endsWith(" ") && !run.str.startsWith(" ")) {
          current += " ";
        }
      }
      current += run.str;
      prev = run;
    }
    segments.push(current);

    const cleaned = segments.map((s) => s.trim()).filter(Boolean);
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (
      cleaned.length >= 2 &&
      first !== undefined &&
      last !== undefined &&
      wordCount(first) >= 3 &&
      wordCount(last) >= 3 &&
      !isDateLike(last)
    ) {
      splitLines += 1;
    }
    const start = row[0]?.x ?? 0;
    const end = row.reduce((max, r) => Math.max(max, r.x + r.width), start);
    const centered = Math.abs((start + end) / 2 - pageWidth / 2) < pageWidth * 0.08;
    if (start > pageWidth * 0.4 && !centered) rightStartLines += 1;

    lines.push(cleaned.join("\t"));
  }

  return { lines, splitLines, rightStartLines };
}

export function looksMultiColumn(pages: AssembledPage[]): boolean {
  const total = pages.reduce((n, p) => n + p.lines.length, 0);
  if (total < 8) return false;
  const split = pages.reduce((n, p) => n + p.splitLines, 0);
  const right = pages.reduce((n, p) => n + p.rightStartLines, 0);
  return (split >= 5 && split / total >= 0.25) || (right >= 5 && right / total >= 0.25);
}

interface TextChunk {
  items: ({ str?: unknown; transform?: unknown; width?: unknown; height?: unknown } | null)[];
}

/**
 * Reads text runs as a stream and cancels it once the per-page cap is reached, so a
 * page with millions of text operators is never fully materialized.
 */
async function readTextItems(stream: ReadableStream<TextChunk>): Promise<PositionedText[]> {
  const reader = stream.getReader();
  const items: PositionedText[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      for (const item of value.items) {
        if (!item || typeof item.str !== "string" || !Array.isArray(item.transform)) continue;
        items.push({
          str: item.str,
          x: Number(item.transform[4]) || 0,
          y: Number(item.transform[5]) || 0,
          width: Number(item.width) || 0,
          height: Number(item.height) || 0,
        });
        if (items.length >= LIMITS.maxPdfItemsPerPage) {
          await reader.cancel();
          return items;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return items;
}

export async function extractPdf(data: Uint8Array, pdfjs: PdfjsLike, signal?: AbortSignal): Promise<PdfResult> {
  const task = pdfjs.getDocument({
    data,
    // Text extraction needs none of these; disabling them shrinks the attack surface.
    useWasm: false,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    disableFontFace: true,
    enableXfa: false,
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
    stopAtErrors: false,
    verbosity: 0,
  });
  const abort = () => void task.destroy();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const doc = await task.promise;
    const pagesParsed = Math.min(doc.numPages, LIMITS.maxPdfPages);
    const pages: AssembledPage[] = [];

    for (let pageNumber = 1; pageNumber <= pagesParsed; pageNumber += 1) {
      if (signal?.aborted) throw new ParseError("timeout");
      const page = await doc.getPage(pageNumber);
      const [x0 = 0, , x1 = 612] = page.view;
      const items = (await readTextItems(page.streamTextContent())).map((item) => ({ ...item, x: item.x - x0 }));
      pages.push(assemblePage(items, Math.abs(x1 - x0) || 612));
      page.cleanup();
    }

    return {
      text: pages.map((p) => p.lines.join("\n")).join("\n\n"),
      pageCount: doc.numPages,
      pagesParsed,
      columns: looksMultiColumn(pages),
    };
  } catch (error) {
    if (error instanceof ParseError) throw error;
    if (signal?.aborted) throw new ParseError("timeout");
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException") throw new ParseError("encrypted_pdf");
    throw new ParseError("invalid_pdf", error instanceof Error ? error.message : undefined);
  } finally {
    signal?.removeEventListener("abort", abort);
    await task.destroy().catch(() => undefined);
  }
}
