import Constants from "expo-constants";
import { z } from "zod";

/**
 * The Expo config is the single source of truth for the app's URL scheme, so the
 * scheme the account emails deep-link back into cannot drift from the one the
 * native build registers. It arrives here as unparsed config, hence the schema.
 */
const schemeSchema = z.string().trim().min(1);

/**
 * Reads the scheme, preferring the first when the config declares several.
 *
 * Throws rather than defaulting: without a scheme the reset and verification
 * links would leave the user stranded in a browser with no way back into the
 * app, and that failure is far harder to diagnose later than at startup.
 */
export function resolveScheme(configured: unknown): string {
  const parsed = schemeSchema.safeParse(
    Array.isArray(configured) ? configured[0] : configured,
  );

  if (!parsed.success) {
    throw new Error(
      'The Expo config declares no usable "scheme", so account deep links cannot be built. Set it in apps/mobile/app.json.',
    );
  }

  return parsed.data;
}

export const appScheme = resolveScheme(Constants.expoConfig?.scheme);
