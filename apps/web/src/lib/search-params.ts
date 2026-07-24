import { z } from "zod";

/**
 * A URL query carries whatever a visitor typed, so a value is `unknown` until it
 * is parsed: a key can be absent, empty, or repeated (which Next hands over as
 * an array). Anything that is not exactly one non-empty string reads as absent,
 * which is the only interpretation a page can safely act on.
 */
const optionalQueryValueSchema = z
  .string()
  .min(1)
  .optional()
  .catch(() => undefined);

export function parseQueryValue(value: unknown): string | undefined {
  return optionalQueryValueSchema.parse(value);
}
