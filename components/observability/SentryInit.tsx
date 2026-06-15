"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Client-side error monitoring. Initializes Sentry in the browser only when
 * NEXT_PUBLIC_SENTRY_DSN is set, so it's a no-op without it. Mounted once in the
 * root layout. Captures unhandled errors and promise rejections in the UI.
 */
let started = false;

export default function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn || started) return;
    started = true;
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
    });
  }, []);
  return null;
}
