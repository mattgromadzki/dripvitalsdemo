import * as Sentry from "@sentry/nextjs";

/**
 * Server/edge error monitoring. Runs when the app boots. It only initializes
 * Sentry if SENTRY_DSN is set, so without it (local/dev/demo) this is a no-op
 * and nothing changes. Add SENTRY_DSN in production to start capturing
 * server-side errors (API routes, server rendering, integration failures).
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  });
}

// Next.js calls this on server-side request errors → forward them to Sentry.
export const onRequestError = Sentry.captureRequestError;
