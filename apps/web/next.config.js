/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * The response headers every route carries.
 *
 * Deliberately no `script-src`. The App Router bootstraps its RSC payload with
 * inline script the framework does not nonce, so the only honest ways to send
 * one are `'unsafe-inline'` — which buys nothing and reads as protection this
 * application has not earned — or a nonce, which needs middleware and forces
 * every page that uses one to render dynamically. A template must not make
 * either choice on behalf of the products built from it. `frame-ancestors`
 * needs neither, and it is the directive that closes clickjacking.
 *
 * `preload` is likewise absent from HSTS: submitting a domain to the preload
 * list is a commitment the product's owner makes about their own domain, and it
 * is difficult to reverse.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

/** @type {import("next").NextConfig} */
const config = {
  headers: () =>
    Promise.resolve([{ headers: securityHeaders, source: "/:path*" }]),
  // The framework's version is a free hint to anyone matching published
  // advisories against a deployment.
  poweredByHeader: false,
  transpilePackages: [
    "@ai-starter/api",
    "@ai-starter/domain",
    "@ai-starter/db",
    "@ai-starter/email",
    "@ai-starter/i18n",
  ],
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const hasSentryBuildCredentials = Boolean(
  sentryAuthToken && sentryOrg && sentryProject,
);

const sourceMapOptions =
  sentryAuthToken && sentryOrg && sentryProject
    ? {
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        widenClientFileUpload: true,
      }
    : {
        release: { create: false },
        sourcemaps: { disable: true },
      };

export default withSentryConfig(withNextIntl(config), {
  silent: !hasSentryBuildCredentials || !process.env.CI,
  telemetry: hasSentryBuildCredentials,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  ...sourceMapOptions,
});
