"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/config";
import { importResumeJson } from "@/lib/resume/import";
import { sampleResume } from "@/lib/resume/sample";
import {
  emptyCertificate,
  emptyEducation,
  emptyLanguage,
  emptyProfile,
  emptyProject,
  emptyResume,
  emptySkill,
  emptyWork,
  FIELD_LIMITS as L,
  isValidEmail,
  LIST_LIMITS,
  MAX_IMPORT_BYTES,
  resumeSchema,
  toSafeUrl,
  type ResumeData,
} from "@/lib/resume/schema";
import { normalizeMonth } from "@/lib/resume/format";
import { clearResume, getPersistence, loadResume, readBackup } from "@/lib/resume/storage";
import { fold } from "@/lib/text/normalize";
import { CsvField, Field, linesToList, ListEditor, listToLines } from "./fields";
import { ResumeDocument } from "./resume-document";
import { createResumeStore } from "./resume-store";

type BuilderDict = Dictionary["builder"];
type Notice = { kind: "ok" | "error"; text: string } | null;

function hasContent(r: ResumeData): boolean {
  return (
    !!r.basics.name.trim() ||
    !!r.basics.summary.trim() ||
    r.work.length > 0 ||
    r.education.length > 0 ||
    r.skills.length > 0 ||
    r.projects.length > 0
  );
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function Builder({ dict, locale }: { dict: BuilderDict; locale: Locale }) {
  const t = dict;
  const f = t.fields;
  const router = useRouter();
  const ids = useId();
  const importRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const runMenu = (action: () => unknown) => {
    if (menuRef.current) menuRef.current.open = false;
    action();
  };

  const [initial] = useState(loadResume);
  const [store] = useState(() =>
    createResumeStore(initial.status === "ok" ? initial.data : emptyResume(locale), getPersistence()),
  );
  const { resume, persist, saveFailed } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [backup] = useState(() => (initial.status === "unreadable" ? readBackup() : null));
  const [notice, setNotice] = useState<Notice>(() =>
    initial.status === "unreadable" ? { kind: "error", text: t.storageUnreadable } : null,
  );

  const setResume = (next: ResumeData) => store.update(() => next);
  const set = (patch: Partial<ResumeData>) => store.update((prev) => ({ ...prev, ...patch }));
  const setBasics = (patch: Partial<ResumeData["basics"]>) =>
    store.update((prev) => ({ ...prev, basics: { ...prev.basics, ...patch } }));

  const listLabels = {
    add: t.add,
    remove: t.remove,
    moveUp: t.moveUp,
    moveDown: t.moveDown,
    limitReached: t.limitReached,
    item: t.item,
  };
  const urlError = (value: string) => (value.trim() && toSafeUrl(value) === null ? t.invalidUrl : null);
  const dateField = (label: string, value: string, onChange: (value: string) => void) => (
    <Field
      label={label}
      value={value}
      maxLength={20}
      placeholder={t.datePlaceholder}
      error={value.trim() && !normalizeMonth(value) ? t.invalidDate : null}
      onChange={onChange}
    />
  );

  const replaceWith = (next: ResumeData) => {
    if (hasContent(resume) && !window.confirm(t.confirmReplace)) return false;
    setResume(next);
    return true;
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setNotice({ kind: "error", text: t.importErrors.too_large });
      return;
    }
    const result = importResumeJson(await file.text(), resume.meta.language);
    if (!result.ok) {
      setNotice({ kind: "error", text: t.importErrors[result.error] });
      return;
    }
    if (replaceWith(result.data)) setNotice({ kind: "ok", text: t.importOk });
  };

  const onExport = () => {
    const parsed = resumeSchema.safeParse(resume);
    if (!parsed.success) {
      setNotice({ kind: "error", text: t.exportFailed });
      return;
    }
    const slug = fold(resume.basics.name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "cvlint";
    download(`resume-${slug}.json`, JSON.stringify(parsed.data, null, 2));
  };

  const onClear = () => {
    if (!window.confirm(t.confirmClear)) return;
    setResume(emptyResume(resume.meta.language));
    clearResume();
    setNotice(null);
  };

  const onAnalyze = () => router.push(`/${locale}/checker?source=builder`);

  const { basics } = resume;

  return (
    <>
      <div className="builder-toolbar no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          {t.actions.print}
        </button>
        <button type="button" className="btn" onClick={onAnalyze}>
          {t.actions.analyze}
        </button>
        <details className="menu" ref={menuRef}>
          <summary className="btn">{t.actions.more}</summary>
          <div className="menu-items">
            <button type="button" onClick={() => runMenu(onExport)}>
              {t.actions.exportJson}
            </button>
            <button type="button" onClick={() => runMenu(() => importRef.current?.click())}>
              {t.actions.importJson}
            </button>
            <button type="button" onClick={() => runMenu(() => replaceWith(sampleResume(resume.meta.language)))}>
              {t.actions.loadExample}
            </button>
            <button type="button" className="danger" onClick={() => runMenu(onClear)}>
              {t.actions.clear}
            </button>
          </div>
        </details>
        <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={onImport} data-testid="import-input" />
        <label className="checkbox">
          <input type="checkbox" checked={persist} onChange={(e) => store.setPersist(e.target.checked)} />
          {t.persist}
        </label>
      </div>
      <div className="status-line no-print" aria-live="polite">
        {notice && (
          <p className={notice.kind === "ok" ? "alert alert-ok" : "alert alert-error"}>
            {notice.text}{" "}
            {backup && notice.text === t.storageUnreadable && (
              <button type="button" className="btn btn-small" onClick={() => download("cvlint-backup.json", backup)}>
                {t.downloadBackup}
              </button>
            )}
          </p>
        )}
        {saveFailed && <p className="alert alert-error">{t.storageFailed}</p>}
      </div>
      <div className="builder-grid">
        <form className="stack no-print" onSubmit={(e) => e.preventDefault()} aria-label={t.title}>
          <fieldset className="form-section">
            <legend>{t.sections.basics}</legend>
            <div className="field-grid">
              <div>
                <label htmlFor={`${ids}-lang`}>{t.resumeLanguage}</label>
                <select
                  id={`${ids}-lang`}
                  value={resume.meta.language}
                  onChange={(e) => set({ meta: { ...resume.meta, language: e.target.value === "pt" ? "pt" : "en" } })}
                >
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${ids}-tpl`}>{t.template}</label>
                <select
                  id={`${ids}-tpl`}
                  value={resume.meta.template}
                  onChange={(e) => set({ meta: { ...resume.meta, template: e.target.value === "modern" ? "modern" : "classic" } })}
                >
                  <option value="classic">{t.templates.classic}</option>
                  <option value="modern">{t.templates.modern}</option>
                </select>
              </div>
              <Field label={f.name} value={basics.name} maxLength={L.medium} autoComplete="name" onChange={(name) => setBasics({ name })} />
              <Field label={f.label} value={basics.label} maxLength={L.medium} onChange={(label) => setBasics({ label })} />
              <Field
                label={f.email}
                type="email"
                value={basics.email}
                maxLength={254}
                autoComplete="email"
                error={basics.email.trim() && !isValidEmail(basics.email.trim()) ? t.invalidEmail : null}
                onChange={(email) => setBasics({ email })}
              />
              <Field label={f.phone} type="tel" value={basics.phone} maxLength={40} autoComplete="tel" onChange={(phone) => setBasics({ phone })} />
              <Field label={f.location} value={basics.location} maxLength={L.medium} onChange={(location) => setBasics({ location })} />
              <Field
                label={f.url}
                type="url"
                value={basics.url}
                maxLength={L.url}
                placeholder="https://"
                error={urlError(basics.url)}
                onChange={(url) => setBasics({ url })}
              />
              <Field
                full
                multiline
                label={f.summary}
                value={basics.summary}
                maxLength={L.summary}
                onChange={(summary) => setBasics({ summary })}
              />
            </div>
          </fieldset>

          <ListEditor
            title={t.sections.profiles}
            items={basics.profiles}
            max={LIST_LIMITS.profiles}
            create={emptyProfile}
            onChange={(profiles) => setBasics({ profiles })}
            labels={listLabels}
            itemTitle={(p) => p.network}
            renderItem={(p, patch) => (
              <div className="field-grid">
                <Field label={f.network} value={p.network} maxLength={L.short} placeholder="LinkedIn" onChange={(network) => patch({ network })} />
                <Field
                  label={f.profileUrl}
                  type="url"
                  value={p.url}
                  maxLength={L.url}
                  placeholder="https://linkedin.com/in/…"
                  error={urlError(p.url)}
                  onChange={(url) => patch({ url })}
                />
              </div>
            )}
          />

          <ListEditor
            title={t.sections.work}
            items={resume.work}
            max={LIST_LIMITS.work}
            create={emptyWork}
            onChange={(work) => set({ work })}
            labels={listLabels}
            itemTitle={(w) => [w.position, w.company].filter(Boolean).join(" — ")}
            renderItem={(w, patch) => (
              <div className="field-grid">
                <Field label={f.position} value={w.position} maxLength={L.medium} onChange={(position) => patch({ position })} />
                <Field label={f.company} value={w.company} maxLength={L.medium} onChange={(company) => patch({ company })} />
                <Field label={f.workLocation} value={w.location} maxLength={L.medium} onChange={(location) => patch({ location })} />
                {dateField(f.startDate, w.startDate, (startDate) => patch({ startDate }))}
                {!w.current && dateField(f.endDate, w.endDate, (endDate) => patch({ endDate }))}
                <label className="checkbox full">
                  <input type="checkbox" checked={w.current} onChange={(e) => patch({ current: e.target.checked, endDate: "" })} />
                  {f.current}
                </label>
                <Field
                  full
                  multiline
                  rows={5}
                  label={f.highlights}
                  value={listToLines(w.highlights)}
                  maxLength={(L.highlight + 1) * LIST_LIMITS.highlights}
                  onChange={(v) => patch({ highlights: linesToList(v, LIST_LIMITS.highlights, L.highlight) })}
                />
              </div>
            )}
          />

          <ListEditor
            title={t.sections.education}
            items={resume.education}
            max={LIST_LIMITS.education}
            create={emptyEducation}
            onChange={(education) => set({ education })}
            labels={listLabels}
            itemTitle={(e) => e.institution}
            renderItem={(e, patch) => (
              <div className="field-grid">
                <Field label={f.institution} value={e.institution} maxLength={L.long} onChange={(institution) => patch({ institution })} />
                <Field label={f.area} value={e.area} maxLength={L.long} onChange={(area) => patch({ area })} />
                <Field label={f.studyType} value={e.studyType} maxLength={L.medium} onChange={(studyType) => patch({ studyType })} />
                {dateField(f.startDate, e.startDate, (startDate) => patch({ startDate }))}
                {dateField(f.endDate, e.endDate, (endDate) => patch({ endDate }))}
              </div>
            )}
          />

          <ListEditor
            title={t.sections.skills}
            items={resume.skills}
            max={LIST_LIMITS.skills}
            create={emptySkill}
            onChange={(skills) => set({ skills })}
            labels={listLabels}
            itemTitle={(s) => s.name}
            renderItem={(s, patch) => (
              <div className="field-grid">
                <Field label={f.skillName} value={s.name} maxLength={L.short} onChange={(name) => patch({ name })} />
                <CsvField
                  label={f.skillKeywords}
                  items={s.keywords}
                  maxItems={LIST_LIMITS.skillKeywords}
                  maxItemLength={L.short}
                  onChange={(keywords) => patch({ keywords })}
                />
              </div>
            )}
          />

          <ListEditor
            title={t.sections.projects}
            items={resume.projects}
            max={LIST_LIMITS.projects}
            create={emptyProject}
            onChange={(projects) => set({ projects })}
            labels={listLabels}
            itemTitle={(p) => p.name}
            renderItem={(p, patch) => (
              <div className="field-grid">
                <Field label={f.projectName} value={p.name} maxLength={L.medium} onChange={(name) => patch({ name })} />
                <Field label="URL" type="url" value={p.url} maxLength={L.url} error={urlError(p.url)} onChange={(url) => patch({ url })} />
                <Field full multiline rows={3} label={f.description} value={p.description} maxLength={L.description} onChange={(description) => patch({ description })} />
                <Field
                  full
                  multiline
                  rows={3}
                  label={f.highlights}
                  value={listToLines(p.highlights)}
                  maxLength={(L.highlight + 1) * LIST_LIMITS.projectHighlights}
                  onChange={(v) => patch({ highlights: linesToList(v, LIST_LIMITS.projectHighlights, L.highlight) })}
                />
              </div>
            )}
          />

          <ListEditor
            title={t.sections.certificates}
            items={resume.certificates}
            max={LIST_LIMITS.certificates}
            create={emptyCertificate}
            onChange={(certificates) => set({ certificates })}
            labels={listLabels}
            itemTitle={(c) => c.name}
            renderItem={(c, patch) => (
              <div className="field-grid">
                <Field label={f.certName} value={c.name} maxLength={L.long} onChange={(name) => patch({ name })} />
                <Field label={f.issuer} value={c.issuer} maxLength={L.medium} onChange={(issuer) => patch({ issuer })} />
                {dateField(f.date, c.date, (date) => patch({ date }))}
                <Field label="URL" type="url" value={c.url} maxLength={L.url} error={urlError(c.url)} onChange={(url) => patch({ url })} />
              </div>
            )}
          />

          <ListEditor
            title={t.sections.languages}
            items={resume.languages}
            max={LIST_LIMITS.languages}
            create={emptyLanguage}
            onChange={(languages) => set({ languages })}
            labels={listLabels}
            itemTitle={(l) => l.language}
            renderItem={(l, patch) => (
              <div className="field-grid">
                <Field label={f.language} value={l.language} maxLength={L.short} onChange={(language) => patch({ language })} />
                <Field label={f.fluency} value={l.fluency} maxLength={L.short} onChange={(fluency) => patch({ fluency })} />
              </div>
            )}
          />
        </form>

        <section className="preview-pane" aria-label={t.previewTitle}>
          <p className="help no-print">{t.printHint}</p>
          <div className="paper" data-testid="resume-preview">
            <ResumeDocument resume={resume} emptyHint={t.previewTitle} />
          </div>
        </section>
      </div>
    </>
  );
}
