/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import("next").NextConfig} */
const config = {
  transpilePackages: [
    "@ai-starter/api",
    "@ai-starter/domain",
    "@ai-starter/db",
    "@ai-starter/email",
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

export default withSentryConfig(config, {
  silent: !hasSentryBuildCredentials || !process.env.CI,
  telemetry: hasSentryBuildCredentials,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  ...sourceMapOptions,
});
