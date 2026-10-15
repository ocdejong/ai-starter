import { z } from "zod";

const mobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url(),
  EXPO_PUBLIC_SENTRY_DSN: z.url().optional(),
});

// An unset DSN arrives as an empty string from most CI secret stores, and an
// empty string is not a URL; treat it as absent rather than failing to boot.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const mobileEnv = mobileEnvSchema.parse({
  EXPO_PUBLIC_API_URL:
    process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  EXPO_PUBLIC_SENTRY_DSN: sentryDsn === "" ? undefined : sentryDsn,
});
