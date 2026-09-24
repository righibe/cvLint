"use client";

import { useId, useState, type ReactNode } from "react";

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  type?: "text" | "email" | "tel" | "url";
  multiline?: boolean;
  rows?: number;
  full?: boolean;
  placeholder?: string;
  error?: string | null;
  autoComplete?: string;
  inputMode?: "text" | "numeric";
}

export function Field({
  label,
  value,
  onChange,
  maxLength,
  type = "text",
  multiline,
  rows = 4,
  full,
  placeholder,
  error,
  autoComplete,
  inputMode,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const common = {
    id,
    value,
    maxLength,
    placeholder,
    autoComplete,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  };
  return (
    <div className={full ? "full" : undefined}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Comma-separated list input. Keeps the raw text locally so the cursor never jumps
 * while typing; re-syncs only when the list is replaced from outside (import, example).
 */
export function CsvField({
  label,
  items,
  onChange,
  maxItems,
  maxItemLength,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  maxItems: number;
  maxItemLength: number;
}) {
  const external = listToCsv(items);
  const [raw, setRaw] = useState(external);
  const [seen, setSeen] = useState(external);
  if (external !== seen) {
    setSeen(external);
    if (listToCsv(csvToList(raw, maxItems, maxItemLength)) !== external) setRaw(external);
  }
  return (
    <Field
      label={label}
      value={raw}
      maxLength={(maxItemLength + 2) * maxItems}
      onChange={(value) => {
        setRaw(value);
        const next = csvToList(value, maxItems, maxItemLength);
        setSeen(listToCsv(next));
        onChange(next);
      }}
    />
  );
}

interface ListLabels {
  add: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  limitReached: string;
  item: string;
}

interface ListEditorProps<T> {
  title: string;
  items: T[];
  max: number;
  create: () => T;
  onChange: (items: T[]) => void;
  labels: ListLabels;
  itemTitle: (item: T) => string;
  renderItem: (item: T, patch: (changes: Partial<T>) => void) => ReactNode;
}

let nextKey = 0;
const newKey = () => `k${(nextKey += 1)}`;

export function ListEditor<T>({ title, items, max, create, onChange, labels, itemTitle, renderItem }: ListEditorProps<T>) {
  // Stable keys that travel with each item when it moves, so focus and input state follow it.
  const [keys, setKeys] = useState<string[]>(() => items.map(newKey));
  if (keys.length !== items.length) setKeys(items.map(newKey));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const nextItems = [...items];
    const nextKeys = [...keys];
    const [item] = nextItems.splice(from, 1);
    const [key] = nextKeys.splice(from, 1);
    if (item === undefined || key === undefined) return;
    nextItems.splice(to, 0, item);
    nextKeys.splice(to, 0, key);
    setKeys(nextKeys);
    onChange(nextItems);
  };
  const remove = (index: number) => {
    setKeys(keys.filter((_, j) => j !== index));
    onChange(items.filter((_, j) => j !== index));
  };
  const add = () => {
    setKeys([...keys, newKey()]);
    onChange([...items, create()]);
  };
  const full = items.length >= max;

  return (
    <fieldset className="form-section">
      <legend>{title}</legend>
      {items.map((item, i) => {
        const name = itemTitle(item).trim() || `${labels.item} ${i + 1}`;
        return (
          <div className="list-item" key={keys[i] ?? i}>
            <div className="list-item-head">
              <span className="title">{name}</span>
              <button type="button" className="btn btn-small" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`${labels.moveUp}: ${name}`}>
                ↑
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => move(i, i + 1)}
                disabled={i === items.length - 1}
                aria-label={`${labels.moveDown}: ${name}`}
              >
                ↓
              </button>
              <button type="button" className="btn btn-small btn-danger" onClick={() => remove(i)} aria-label={`${labels.remove}: ${name}`}>
                {labels.remove}
              </button>
            </div>
            {renderItem(item, (changes) => onChange(items.map((it, j) => (j === i ? { ...it, ...changes } : it))))}
          </div>
        );
      })}
      <button type="button" className="btn btn-small" onClick={add} disabled={full}>
        + {full ? labels.limitReached : labels.add}
      </button>
    </fieldset>
  );
}

/** Newline-separated textarea <-> string[]; each line is capped at the schema limit. */
export const linesToList = (value: string, maxItems: number, maxLength: number) =>
  value
    .split("\n")
    .slice(0, maxItems)
    .map((line) => line.slice(0, maxLength));
export const listToLines = (items: string[]) => items.join("\n");

/** Comma-separated text <-> string[]; only leading spaces are trimmed so typing feels natural. */
export const csvToList = (value: string, maxItems: number, maxLength: number) =>
  value
    .split(",")
    .map((s) => s.replace(/^\s+/, "").slice(0, maxLength))
    .slice(0, maxItems);
export const listToCsv = (items: string[]) => items.join(", ");
