/**
 * Central place for deployment-related env checks (Vercel, local, CI).
 */

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url || !String(url).trim()) {
    return false;
  }

  return true;
}

export function hasOpenAiApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Canonical public URL for links and metadata.
 * Prefer NEXT_PUBLIC_APP_URL; on Vercel fall back to VERCEL_URL.
 */
export function getPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}
