"use client";

import { useSearchParams } from "next/navigation";
import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { analyzeResume } from "@/lib/ats/analyze";
import type { AnalysisResult, LayoutSignals } from "@/lib/ats/types";
import { toParseError } from "@/lib/parser/errors";
import { parseFile } from "@/lib/parser";
import { LIMITS } from "@/lib/parser/limits";
import type { PdfjsLike } from "@/lib/parser/pdf";
import { loadResume } from "@/lib/resume/storage";
import { resumeToText } from "@/lib/resume/to-text";
import { normalizeText } from "@/lib/text/normalize";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { ScoreReport } from "./score-report";

type Source = "upload" | "paste" | "builder";
type CheckerDict = Pick<Dictionary, "checker" | "report" | "findings" | "errors" | "sectionNames" | "languages" | "common">;

const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const MAX_PASTE_CHARS = 60_000;
const MAX_JOB_CHARS = 20_000;

class MissingInput extends Error {}

async function loadPdfjs(): Promise<PdfjsLike> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker.${pdfjs.version}.min.mjs`;
  return pdfjs;
}

function readBuilderText(): string | null {
  const stored = loadResume();
  if (stored.status !== "ok") return null;
  const text = resumeToText(stored.data);
  return text.trim().length > 0 ? text : null;
}

export function Checker({ dict }: { dict: CheckerDict }) {
  const t = dict.checker;
  const params = useSearchParams();
  const ids = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Partial<Record<Source, HTMLButtonElement | null>>>({});

  const [source, setSource] = useState<Source>(() => (params.get("source") === "builder" ? "builder" : "upload"));
  const [builderText, setBuilderText] = useState<string | null>(() => readBuilderText());
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");
  const [job, setJob] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ analysis: AnalysisResult; text: string } | null>(null);

  const selectSource = (next: Source) => {
    setSource(next);
    setError(null);
    setResult(null);
    if (next === "builder") setBuilderText(readBuilderText());
  };

  // A report only describes the inputs it was computed from.
  const changePasted = (value: string) => {
    setPasted(value);
    setResult(null);
  };
  const changeJob = (value: string) => {
    setJob(value);
    setResult(null);
  };

  const pickFile = (picked: File | undefined) => {
    setError(null);
    setResult(null);
    if (!picked) return;
    if (picked.size > LIMITS.maxFileBytes) {
      setFile(null);
      setError(dict.errors.too_large);
      return;
    }
    setFile(picked);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files[0]);
  };

  const analyze = async () => {
    setError(null);
    setBusy(true);
    try {
      let text = "";
      let layout: Partial<LayoutSignals> | undefined;
      let headerFooterText: string | undefined;
      let truncated = false;

      if (source === "upload") {
        if (!file) throw new MissingInput();
        const doc = await parseFile(file, { loadPdfjs });
        ({ text, layout, headerFooterText, truncated } = doc);
      } else if (source === "paste") {
        text = pasted;
      } else {
        text = builderText ?? "";
      }
      if (text.trim() === "" && source !== "upload") throw new MissingInput();

      const analysis = analyzeResume({ resumeText: text, jobText: job, layout, headerFooterText, truncated });
      setResult({ analysis, text: normalizeText(text).text });
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      if (err instanceof MissingInput) setError(t.needInput);
      else setError(dict.errors[toParseError(err).code]);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (fileRef.current) fileRef.current.value = "";
    setFile(null);
    setPasted("");
    setJob("");
    setResult(null);
    setError(null);
  };

  const tabs: Source[] = ["upload", "paste", "builder"];

  // WAI-ARIA tabs: arrow keys, Home and End move between tabs; only the active tab is tabbable.
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.indexOf(source);
    const target =
      event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length]
      : event.key === "ArrowLeft" ? tabs[(index + tabs.length - 1) % tabs.length]
      : event.key === "Home" ? tabs[0]
      : event.key === "End" ? tabs[tabs.length - 1]
      : undefined;
    if (!target) return;
    event.preventDefault();
    selectSource(target);
    tabRefs.current[target]?.focus();
  };

  return (
    <>
      <div className="checker-grid">
        <section className="card" aria-labelledby={`${ids}-source`}>
          <h2 id={`${ids}-source`} className="visually-hidden">
            {t.sourceLegend}
          </h2>
          <div className="tabs" role="tablist" aria-label={t.sourceLegend} onKeyDown={onTabKey}>
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                className="tab"
                ref={(el) => {
                  tabRefs.current[tab] = el;
                }}
                tabIndex={source === tab ? 0 : -1}
                id={`${ids}-tab-${tab}`}
                aria-selected={source === tab}
                aria-controls={`${ids}-panel`}
                onClick={() => selectSource(tab)}
              >
                {t.tabs[tab]}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-tab-${source}`} tabIndex={0}>
            {source === "upload" && (
              <label
                className="dropzone"
                data-dragging={dragging}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    // Allow picking the same file again after an error or "Start over".
                    e.target.value = "";
                  }}
                  data-testid="file-input"
                />
                <strong>{t.dropTitle}</strong>
                <span className="help">{t.dropHint}</span>
                {file && (
                  <span>
                    {t.selected} <span className="file-name">{file.name}</span>
                  </span>
                )}
              </label>
            )}

            {source === "paste" && (
              <>
                <label htmlFor={`${ids}-paste`}>{t.pasteLabel}</label>
                <textarea
                  id={`${ids}-paste`}
                  rows={12}
                  maxLength={MAX_PASTE_CHARS}
                  placeholder={t.pastePlaceholder}
                  value={pasted}
                  onChange={(e) => changePasted(e.target.value)}
                />
              </>
            )}

            {source === "builder" && <p>{builderText ? t.builderReady : t.builderEmpty}</p>}
          </div>
          <p className="privacy-note">{dict.common.privacy}</p>
        </section>

        <section className="card">
          <label htmlFor={`${ids}-job`}>{t.jobLabel}</label>
          <textarea
            id={`${ids}-job`}
            rows={12}
            maxLength={MAX_JOB_CHARS}
            placeholder={t.jobPlaceholder}
            value={job}
            onChange={(e) => changeJob(e.target.value)}
            aria-describedby={`${ids}-job-help`}
          />
          <p className="help" id={`${ids}-job-help`}>
            {t.jobHelp}
          </p>
        </section>
      </div>

      <div className="btn-row report">
        <button type="button" className="btn btn-primary" onClick={analyze} disabled={busy} aria-busy={busy}>
          {busy ? t.analyzing : t.analyze}
        </button>
        <button type="button" className="btn" onClick={reset} disabled={busy}>
          {t.reset}
        </button>
      </div>

      <div aria-live="polite">
        {error && (
          <p className="alert alert-error report" role="alert">
            {error}
          </p>
        )}
      </div>

      {result && (
        <div className="report" ref={resultRef} tabIndex={-1} data-testid="report">
          <ScoreReport result={result.analysis} extractedText={result.text} dict={dict} />
        </div>
      )}
    </>
  );
}
