import type { ReactNode } from "react";
import { displayUrl, formatMonth, formatRange, RESUME_HEADINGS } from "@/lib/resume/format";
import { isValidEmail, toSafeUrl, type ResumeData } from "@/lib/resume/schema";

const filled = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);

/** Renders only when the value is a safe absolute http(s) URL; otherwise plain text or nothing. */
function SafeLink({ value, children }: { value: string; children?: string }) {
  const href = toSafeUrl(value);
  if (!href) return null;
  return (
    <a href={href} rel="noopener noreferrer nofollow" target="_blank">
      {children ?? displayUrl(href)}
    </a>
  );
}

/**
 * Single-column, semantic, text-only layout: real headings, real lists, no
 * tables, columns, icons or images. This is what makes the printed PDF parse well.
 */
export function ResumeDocument({ resume, emptyHint }: { resume: ResumeData; emptyHint: string }) {
  const lang = resume.meta.language;
  const h = RESUME_HEADINGS[lang];
  const { basics } = resume;

  const contact: ReactNode[] = [];
  if (basics.email.trim()) {
    contact.push(
      isValidEmail(basics.email.trim()) ? (
        <a key="email" href={`mailto:${basics.email.trim()}`}>
          {basics.email.trim()}
        </a>
      ) : (
        <span key="email">{basics.email.trim()}</span>
      ),
    );
  }
  if (basics.phone.trim()) contact.push(<span key="phone">{basics.phone.trim()}</span>);
  if (basics.location.trim()) contact.push(<span key="location">{basics.location.trim()}</span>);
  if (toSafeUrl(basics.url)) contact.push(<SafeLink key="url" value={basics.url} />);
  basics.profiles.forEach((p, i) => {
    if (toSafeUrl(p.url)) contact.push(<SafeLink key={`p${i}`} value={p.url} />);
  });

  const work = resume.work.filter((w) => w.company.trim() || w.position.trim());
  const education = resume.education.filter((e) => e.institution.trim() || e.area.trim());
  const skills = resume.skills.filter((s) => s.name.trim() || filled(s.keywords).length);
  const projects = resume.projects.filter((p) => p.name.trim());
  const certificates = resume.certificates.filter((c) => c.name.trim());
  const languages = resume.languages.filter((l) => l.language.trim());

  const isEmpty = !basics.name.trim() && work.length === 0 && education.length === 0 && skills.length === 0;

  return (
    <article className={`resume template-${resume.meta.template}`} lang={lang === "pt" ? "pt-BR" : "en"}>
      <header>
        <h1>{basics.name.trim() || (isEmpty ? <span className="empty-hint">{emptyHint}</span> : null)}</h1>
        {basics.label.trim() && <p className="headline">{basics.label.trim()}</p>}
        {contact.length > 0 && (
          <p className="contact">
            {contact.map((node, i) => (
              <span key={i}>
                {i > 0 && " | "}
                {node}
              </span>
            ))}
          </p>
        )}
      </header>

      {basics.summary.trim() && (
        <section>
          <h2>{h.summary}</h2>
          <p>{basics.summary.trim()}</p>
        </section>
      )}

      {work.length > 0 && (
        <section>
          <h2>{h.experience}</h2>
          {work.map((w, i) => (
            <div className="entry" key={i}>
              <h3>{filled([w.position, w.company]).join(" — ")}</h3>
              <p className="meta">{filled([w.location, formatRange(w.startDate, w.endDate, w.current, lang)]).join(" | ")}</p>
              {filled(w.highlights).length > 0 && (
                <ul>
                  {filled(w.highlights).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {education.length > 0 && (
        <section>
          <h2>{h.education}</h2>
          {education.map((e, i) => (
            <div className="entry" key={i}>
              <h3>{filled([e.studyType, e.area]).join(", ")}</h3>
              <p className="meta">{filled([e.institution, formatRange(e.startDate, e.endDate, false, lang)]).join(" | ")}</p>
            </div>
          ))}
        </section>
      )}

      {skills.length > 0 && (
        <section>
          <h2>{h.skills}</h2>
          <ul>
            {skills.map((s, i) => (
              <li key={i}>
                {s.name.trim() ? <strong>{s.name.trim()}: </strong> : null}
                {filled(s.keywords).join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h2>{h.projects}</h2>
          {projects.map((p, i) => (
            <div className="entry" key={i}>
              <h3>
                {p.name.trim()}
                {toSafeUrl(p.url) && (
                  <>
                    {" | "}
                    <SafeLink value={p.url} />
                  </>
                )}
              </h3>
              {p.description.trim() && <p>{p.description.trim()}</p>}
              {filled(p.highlights).length > 0 && (
                <ul>
                  {filled(p.highlights).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {certificates.length > 0 && (
        <section>
          <h2>{h.certificates}</h2>
          <ul>
            {certificates.map((c, i) => (
              <li key={i}>{filled([c.name, c.issuer, formatMonth(c.date, lang)]).join(" | ")}</li>
            ))}
          </ul>
        </section>
      )}

      {languages.length > 0 && (
        <section>
          <h2>{h.languages}</h2>
          <ul>
            {languages.map((l, i) => (
              <li key={i}>{filled([l.language, l.fluency]).join(" — ")}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
