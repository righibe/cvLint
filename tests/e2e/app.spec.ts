import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { makeDocx, para, simpleResumePdf, wordXml } from "../helpers/fixtures";

const PDFJS_VERSION = (createRequire(import.meta.url)("pdfjs-dist/package.json") as { version: string }).version;

const RESUME_LINES = [
  "Jane Doe",
  "jane.doe@example.com | +1 (555) 123-4567 | linkedin.com/in/janedoe",
  "Summary",
  "Backend engineer with 6 years of experience in Python and Django.",
  "Experience",
  "Senior Engineer, Acme, Jan 2021 - Present",
  "- Led the migration of 40 services to Kubernetes, cutting costs by 30%.",
  "- Built a Django REST API serving 2M requests per day.",
  "- Reduced latency from 800 ms to 120 ms with Redis caching.",
  "Education",
  "B.Sc. Computer Science, State University, 2014 - 2017",
  "Skills",
  "Python, Django, PostgreSQL, Docker, Kubernetes, AWS",
];

const JOB = "Backend Engineer. Requirements: Python, Django, PostgreSQL, Kafka, Terraform and AWS.";

/** Fails the test on any console error, uncaught exception or CSP violation. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test.describe("security", () => {
  test("pages are served with a strict nonce CSP and hardening headers", async ({ request }) => {
    const response = await request.get("/en/checker");
    expect(response.status()).toBe(200);
    const headers = response.headers();
    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]{20,}' 'strict-dynamic'/);
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["cache-control"]).toContain("no-store");

    const html = await response.text();
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(html).toContain(`nonce="${nonce}"`);
  });

  test("every request gets a fresh nonce", async ({ request }) => {
    const a = (await request.get("/en")).headers()["content-security-policy"];
    const b = (await request.get("/en")).headers()["content-security-policy"];
    expect(a).not.toEqual(b);
  });

  test("the PDF worker runs under its own lock-down policy", async ({ request }) => {
    const response = await request.get(`/pdfjs/pdf.worker.${PDFJS_VERSION}.min.mjs`);
    expect(response.status()).toBe(200);
    const csp = response.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    expect(response.headers()["cache-control"]).toContain("immutable");
  });

  test("no HTML response escapes the nonce CSP", async ({ request }) => {
    for (const path of ["/favicon.ico", "/robots.txtX", "/icon.svgfoo", "/_next/staticX", "/pdfjs/other.js", "/en/missing"]) {
      const response = await request.get(path);
      const type = response.headers()["content-type"] ?? "";
      if (type.includes("text/html")) {
        expect(response.headers()["content-security-policy"], path).toMatch(/'nonce-/);
      }
    }
    // Prefetch-style request headers must not switch the proxy off.
    const prefetchHeaders: Record<string, string>[] = [{ purpose: "prefetch" }, { "next-router-prefetch": "1" }];
    for (const headers of prefetchHeaders) {
      const response = await request.get("/en/checker", { headers });
      expect(response.headers()["content-security-policy"] ?? "").toMatch(/'nonce-/);
    }
  });

  test("malformed URLs get a 400, and locale redirects are never cached", async ({ request }) => {
    expect((await request.get("/en/%")).status()).toBe(400);
    const redirect = await request.get("/", { maxRedirects: 0 });
    expect(redirect.status()).toBe(307);
    expect(redirect.headers()["cache-control"]).toContain("no-store");
    expect(redirect.headers()["vary"]).toContain("Accept-Language");
  });

  test("static files are served without a locale redirect", async ({ request }) => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/icon.svg"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
    }
  });

  test("renders pages without CSP violations or console errors", async ({ page }) => {
    const errors = watchErrors(page);
    for (const path of ["/en", "/pt", "/en/checker", "/pt/builder"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("does not reflect unknown locales or paths", async ({ page }) => {
    const response = await page.goto("/en/<script>alert(1)</script>");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText(/not found|não encontrada/i);
  });
});

test.describe("i18n", () => {
  test("redirects / according to Accept-Language", async ({ browser }) => {
    const pt = await browser.newContext({ locale: "pt-BR" });
    const ptPage = await pt.newPage();
    await ptPage.goto("/");
    await expect(ptPage).toHaveURL(/\/pt$/);
    await expect(ptPage.locator("html")).toHaveAttribute("lang", "pt-BR");
    await pt.close();

    const en = await browser.newContext({ locale: "en-US" });
    const enPage = await en.newPage();
    await enPage.goto("/checker");
    await expect(enPage).toHaveURL(/\/en\/checker$/);
    await en.close();
  });

  test("the language switch keeps the current page and is remembered", async ({ page }) => {
    await page.goto("/en/checker");
    await page.getByRole("link", { name: /português/i }).click();
    await expect(page).toHaveURL(/\/pt\/checker$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/pt$/);
  });
});

test.describe("ATS checker", () => {
  test("analyzes pasted text against a job description", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/en/checker");
    await page.getByRole("tab", { name: "Paste text" }).click();
    await page.getByLabel("Resume text").fill(RESUME_LINES.join("\n"));
    await page.getByLabel(/Job description/).fill(JOB);
    await page.getByRole("button", { name: "Analyze" }).click();

    const report = page.getByTestId("report");
    await expect(report).toBeVisible();
    await expect(report.getByRole("img", { name: /ATS score: \d+\/100/ })).toBeVisible();
    await expect(report.locator(".chip-miss", { hasText: "Kafka" })).toBeVisible();
    await expect(report.locator(".chip-hit", { hasText: "Python" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("parses an uploaded PDF in the browser (pdf.js worker under CSP)", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/en/checker");
    await page.getByTestId("file-input").setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(simpleResumePdf(RESUME_LINES)),
    });
    await page.getByRole("button", { name: "Analyze" }).click();
    const report = page.getByTestId("report");
    await expect(report).toBeVisible();
    await report.getByText("What the ATS reads").click();
    await expect(report.locator("pre.extracted")).toContainText("jane.doe@example.com");
    expect(errors).toEqual([]);
  });

  test("parses an uploaded DOCX and reports layout problems", async ({ page }) => {
    await page.goto("/pt/checker");
    const docx = makeDocx({
      "word/document.xml": wordXml(RESUME_LINES.map(para).join("") + `<w:tbl><w:tr><w:tc>${para("x")}</w:tc></w:tr></w:tbl>`),
    });
    await page.getByTestId("file-input").setInputFiles({ name: "cv.docx", mimeType: "application/octet-stream", buffer: Buffer.from(docx) });
    await page.getByRole("button", { name: "Analisar" }).click();
    await expect(page.getByTestId("report")).toContainText("tabela");
  });

  test("rejects disguised and unsupported files with a clear message", async ({ page }) => {
    await page.goto("/en/checker");
    await page.getByTestId("file-input").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf") });
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("does not match its extension");

    await page.getByTestId("file-input").setInputFiles({ name: "old.doc", mimeType: "application/msword", buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) });
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.locator("p[role=alert]")).toContainText(".doc");
  });

  test("asks for input when nothing was provided", async ({ page }) => {
    await page.goto("/en/checker");
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Add a file");
  });
});

test.describe("resume builder", () => {
  test("edits, previews, and hands the resume to the checker", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/en/builder");
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await expect(page.getByTestId("resume-preview").locator("h1")).toHaveText("Ada Lovelace");

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("summary", { hasText: "More" }).click();
    await page.getByRole("button", { name: "Load example" }).click();
    await expect(page.getByTestId("resume-preview")).toContainText("Alex Moreira");

    // Persisted locally across reloads.
    await page.reload();
    await expect(page.getByTestId("resume-preview")).toContainText("Alex Moreira");

    await page.getByRole("button", { name: "Check with ATS" }).click();
    await expect(page).toHaveURL(/\/en\/checker\?source=builder$/);
    await expect(page.getByRole("tab", { name: "From builder" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.getByTestId("report")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("exports JSON and neutralizes hostile imports", async ({ page }) => {
    await page.goto("/en/builder");
    await page.getByLabel("Full name").fill("Export Me");
    await page.locator("summary", { hasText: "More" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export JSON" }).click()]);
    expect(download.suggestedFilename()).toBe("resume-export-me.json");

    const hostile = {
      version: 1,
      meta: { language: "en", template: "modern" },
      basics: {
        name: "<img src=x onerror=alert(1)>",
        label: "",
        email: "a@b.co?cc=x@y.z",
        phone: "",
        location: "",
        url: "javascript:alert(document.domain)",
        summary: "",
        profiles: [{ network: "x", url: "data:text/html,<script>alert(1)</script>" }],
      },
      work: [],
      education: [],
      skills: [],
      projects: [],
      certificates: [],
      languages: [],
    };
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("import-input").setInputFiles({
      name: "evil.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(hostile)),
    });
    const preview = page.getByTestId("resume-preview");
    await expect(preview.locator("h1")).toHaveText("<img src=x onerror=alert(1)>");
    await expect(preview.locator("img")).toHaveCount(0);
    const hrefs = await preview.locator("a").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs) expect(href).toMatch(/^(https?:|mailto:)/);
    expect(hrefs.some((h) => h.startsWith("mailto:"))).toBe(false);
  });

  test("accepts typed dates and can stop saving on this device", async ({ page }) => {
    await page.goto("/en/builder");
    await page.getByRole("button", { name: "+ Add" }).nth(1).click();
    await page.getByLabel("Position").fill("Engineer");
    await page.getByLabel("Start").fill("03/2021");
    await expect(page.getByTestId("resume-preview")).toContainText("Mar 2021");
    await page.getByLabel("Start").fill("someday");
    await expect(page.getByText("Use MM/YYYY")).toBeVisible();
    await page.getByLabel("Start").fill("03/2021");

    await page.reload();
    await expect(page.getByTestId("resume-preview")).toContainText("Mar 2021");

    await page.getByLabel("Save in this browser").uncheck();
    await page.reload();
    await expect(page.getByTestId("resume-preview")).not.toContainText("Engineer");
    await expect(page.getByLabel("Save in this browser")).not.toBeChecked();
    await page.getByLabel("Save in this browser").check();
  });

  test("rejects invalid JSON imports", async ({ page }) => {
    await page.goto("/pt/builder");
    await page.getByTestId("import-input").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{nope") });
    await expect(page.locator(".alert-error")).toContainText("JSON válido");
  });
});

test("layout has no horizontal overflow on a phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  for (const path of ["/en", "/en/checker", "/en/builder"]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await context.close();
});
