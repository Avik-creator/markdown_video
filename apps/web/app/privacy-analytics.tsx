"use client";

import { Analytics } from "@vercel/analytics/next";
import { beforeSendAnalyticsEvent } from "@/lib/analytics";

/**
 * Privacy-preserving wrapper around Vercel Analytics. It exists because the
 * root layout is a server component and function props (like `beforeSend`)
 * are not serializable across the server/client boundary — the middleware has
 * to be attached inside a client component.
 *
 * The beforeSend middleware strips the query string and hash fragment from
 * every reported URL so inline share links (?md=<full document>) can never
 * leak user markdown into analytics events.
 */
export function PrivacyAnalytics() {
  return <Analytics beforeSend={beforeSendAnalyticsEvent} />;
}
