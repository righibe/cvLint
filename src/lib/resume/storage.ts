import { safeJsonParse } from "./import";
import { resumeSchema, type ResumeData } from "./schema";

const RESUME_KEY = "cvlint:resume:v1";
const BACKUP_KEY = "cvlint:resume:unreadable";
const PERSIST_KEY = "cvlint:persist";
const MAX_STORED_CHARS = 1_000_000;

// localStorage can be missing or throw (private mode, blocked site data, quota):
// every access is wrapped so the app keeps working in memory.
function localStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export type LoadResult = { status: "empty" } | { status: "ok"; data: ResumeData } | { status: "unreadable" };

export function loadResume(): LoadResult {
  const store = localStore();
  let raw: string | null;
  try {
    raw = store?.getItem(RESUME_KEY) ?? null;
  } catch {
    return { status: "empty" };
  }
  if (!raw) return { status: "empty" };

  try {
    if (raw.length <= MAX_STORED_CHARS) {
      const result = resumeSchema.safeParse(safeJsonParse(raw));
      if (result.success) return { status: "ok", data: result.data };
    }
  } catch {
    // unreadable, handled below
  }
  // Copy the unreadable data aside before the editor overwrites it. Idempotent on
  // purpose: React may call this twice in development.
  try {
    store?.setItem(BACKUP_KEY, raw.slice(0, MAX_STORED_CHARS));
  } catch {
    // ignore
  }
  return { status: "unreadable" };
}

export function saveResume(data: ResumeData): boolean {
  try {
    const store = localStore();
    if (!store) return false;
    store.setItem(RESUME_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** The copy set aside by loadResume() when the saved data could not be read. */
export function readBackup(): string | null {
  try {
    return localStore()?.getItem(BACKUP_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Whether the user allows saving on this device (default: yes). */
export function getPersistence(): boolean {
  try {
    return localStore()?.getItem(PERSIST_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setPersistence(on: boolean): void {
  try {
    if (on) localStore()?.removeItem(PERSIST_KEY);
    else localStore()?.setItem(PERSIST_KEY, "off");
  } catch {
    // ignore
  }
}

export function clearResume(): void {
  try {
    localStore()?.removeItem(RESUME_KEY);
    localStore()?.removeItem(BACKUP_KEY);
  } catch {
    // ignore
  }
}
