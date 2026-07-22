import { z } from "zod";

const mobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url(),
});

export const mobileEnv = mobileEnvSchema.parse({
  EXPO_PUBLIC_API_URL:
    process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
});
