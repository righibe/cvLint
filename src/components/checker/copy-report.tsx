"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";

type State = "idle" | "copied" | "downloaded";

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Copies the report as Markdown; when the clipboard is blocked, saves it as a file instead. */
export function CopyReport({ getMarkdown, dict }: { getMarkdown: () => string; dict: Dictionary["report"] }) {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2_500);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    const markdown = getMarkdown();
    try {
      await navigator.clipboard.writeText(markdown);
      setState("copied");
    } catch {
      download("cvlint-report.md", markdown);
      setState("downloaded");
    }
  };

  return (
    <div className="btn-row report-actions">
      <button type="button" className="btn btn-small" onClick={copy} data-testid="copy-report">
        {dict.copy}
      </button>
      <span className="help" role="status">
        {state === "copied" ? dict.copied : state === "downloaded" ? dict.downloaded : ""}
      </span>
    </div>
  );
}
