import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** An env file in `apps/web`, or undefined when it does not exist. */
export function readAppEnvFile(name: string): string | undefined {
  try {
    return readFileSync(
      fileURLToPath(new URL(`../../${name}`, import.meta.url)),
      "utf8",
    );
  } catch {
    return undefined;
  }
}
