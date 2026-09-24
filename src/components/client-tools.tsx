"use client";

import dynamic from "next/dynamic";

// Both tools read browser storage on first render, so they are never server-rendered.
export const CheckerTool = dynamic(() => import("./checker/checker").then((m) => m.Checker), {
  ssr: false,
  loading: () => <p className="help">…</p>,
});

export const BuilderTool = dynamic(() => import("./builder/builder").then((m) => m.Builder), {
  ssr: false,
  loading: () => <p className="help">…</p>,
});
