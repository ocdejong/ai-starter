import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  envFileWebOrigin,
  resolveWebOrigin,
  sharedWebOriginError,
} from "../../src/test/web-origin";
import { readAppEnvFile } from "./env-file";

/**
 * Refuses to run the suite where it would drive a sibling worktree's server.
 *
 * A linked worktree still naming the origin every checkout starts from never
 * had one derived, and Playwright would reuse whichever dev server reached that
 * port first. The check is here and not in `playwright.config.ts` because a
 * config that throws on load cannot be loaded by anything but a run: knip then
 * drops the Playwright and Vitest entries and reports false unused exports in
 * every fresh worktree.
 */
export default function globalSetup(): void {
  const override = process.env.E2E_BASE_URL;
  if (override !== undefined && override !== "") {
    return;
  }

  const exampleEnv = readAppEnvFile(".env.example");
  const conflict = sharedWebOriginError(
    resolveWebOrigin(override, readAppEnvFile(".env")),
    exampleEnv === undefined ? undefined : envFileWebOrigin(exampleEnv),
    isLinkedWorktree(),
  );
  if (conflict !== undefined) {
    throw new Error(conflict);
  }
}

/** A linked worktree marks its root with a `.git` file; a clone has a directory. */
function isLinkedWorktree(): boolean {
  try {
    return statSync(
      fileURLToPath(new URL("../../../../.git", import.meta.url)),
    ).isFile();
  } catch {
    return false;
  }
}
