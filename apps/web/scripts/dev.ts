import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { envFileWebOrigin } from "../src/test/web-origin.ts";

/**
 * Starts `next dev` on the port this checkout's `.env` names. The Next CLI
 * resolves its port before env files load, so `BETTER_AUTH_URL`'s origin —
 * which bootstrap derives per git worktree — cannot reach it as a variable;
 * without this wrapper a worktree's dev server would bind :3000 while its
 * auth links point at the derived origin. An explicit `--port` (what the
 * Playwright web server passes) wins unchanged.
 */
const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const args = process.argv.slice(2);

const portGiven = args.some(
  (argument) =>
    argument === "--port" ||
    argument === "-p" ||
    argument.startsWith("--port="),
);
if (!portGiven) {
  const port = configuredPort();
  if (port !== undefined) {
    args.push("--port", port);
  }
}

const result = spawnSync("next", ["dev", "--turbo", ...args], {
  cwd: appRoot,
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;

function configuredPort(): string | undefined {
  let content: string;
  try {
    content = readFileSync(path.join(appRoot, ".env"), "utf8");
  } catch {
    return undefined;
  }

  const origin = envFileWebOrigin(content);
  if (origin === undefined) {
    return undefined;
  }
  try {
    return new URL(origin).port || undefined;
  } catch {
    return undefined;
  }
}
