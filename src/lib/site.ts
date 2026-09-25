export const REPO_URL = "https://github.com/righibe/cvLint";

/**
 * Canonical site origin, used for metadata, robots and sitemap. NEXT_PUBLIC_* values
 * are inlined at build time, so it is passed as a Docker build argument.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  return new URL(explicit || "http://localhost:3000");
}
