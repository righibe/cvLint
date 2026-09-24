import type { Finding } from "@/lib/ats/types";
import type { Dictionary } from "@/i18n/dictionaries/en";

type Dict = Pick<Dictionary, "findings" | "sectionNames" | "languages">;

function lookup<T extends Record<string, string>>(table: T, key: string): string {
  return Object.hasOwn(table, key) ? table[key as keyof T]! : key;
}

function formatParam(key: string, value: string, dict: Dict): string {
  switch (key) {
    case "sections":
      return value
        .split(",")
        .map((id) => lookup(dict.sectionNames, id))
        .join(", ");
    case "section":
    case "suggestion":
      return lookup(dict.sectionNames, value);
    case "resume":
    case "job":
      return lookup(dict.languages, value);
    default:
      return value;
  }
}

/** Fills "{param}" placeholders. The result is rendered as a text node, never as HTML. */
export function formatFinding(finding: Finding, dict: Dict): string {
  const template = dict.findings[finding.id];
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = finding.params?.[key];
    return value === undefined ? "" : formatParam(key, String(value), dict);
  });
}
