import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

Sentry.init({
  dsn,
  enabled: Boolean(dsn) && process.env.NODE_ENV !== "test",
  // `sendDefaultPii: false` until v11, written out category by category:
  // v11's defaults collect each one, so a category left out is a category
  // sent. This is Sentry's own "keep the v10 default" baseline.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    },
    httpBodies: [],
    urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
  },
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
