/**
 * Strict nonce-based Content-Security-Policy for HTML pages.
 * - scripts: only those carrying this request's nonce (and what they load, via 'strict-dynamic')
 * - no eval in production, no inline styles, no plugins, no framing, no third-party origins
 * - workers only from our origin (the PDF.js worker)
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", ...(isDev ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`])],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(isDev ? ["ws:"] : [])],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "media-src": ["'none'"],
    "object-src": ["'none'"],
    "frame-src": ["'none'"],
    "child-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** 128 bits from the platform CSPRNG, base64-encoded. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
