import type { Dictionary } from "@/i18n/dictionaries/en";
import { REPO_URL } from "@/lib/site";

export function SiteFooter({ footer }: { footer: Dictionary["footer"] }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <span>
          {footer.left} ·{" "}
          <a href={REPO_URL} rel="noopener noreferrer" target="_blank">
            ★ {footer.github}
          </a>
        </span>
        <span>
          {footer.madeBy} Bernardo Righi ·{" "}
          <a className="mono" href="https://righi.dev" rel="noopener noreferrer" target="_blank">
            righi.dev
          </a>
        </span>
      </div>
    </footer>
  );
}
