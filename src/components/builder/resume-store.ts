import type { ResumeData } from "@/lib/resume/schema";
import { clearResume, saveResume, setPersistence } from "@/lib/resume/storage";

export interface ResumeSnapshot {
  resume: ResumeData;
  persist: boolean;
  saveFailed: boolean;
}

/**
 * Minimal external store for the editor. While persistence is on, every change is
 * written to localStorage synchronously, so nothing is lost on reload, tab close or
 * client navigation. With persistence off (shared computers) nothing is stored.
 */
export function createResumeStore(initial: ResumeData, persist: boolean) {
  let snapshot: ResumeSnapshot = { resume: initial, persist, saveFailed: false };
  const listeners = new Set<() => void>();
  const emit = (next: ResumeSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(recipe: (current: ResumeData) => ResumeData) {
      const resume = recipe(snapshot.resume);
      if (resume === snapshot.resume) return;
      emit({ ...snapshot, resume, saveFailed: snapshot.persist ? !saveResume(resume) : false });
    },
    setPersist(on: boolean) {
      setPersistence(on);
      if (on) emit({ ...snapshot, persist: true, saveFailed: !saveResume(snapshot.resume) });
      else {
        clearResume();
        emit({ ...snapshot, persist: false, saveFailed: false });
      }
    },
  };
}

export type ResumeStore = ReturnType<typeof createResumeStore>;
