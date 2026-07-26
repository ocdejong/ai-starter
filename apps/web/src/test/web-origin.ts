/**
 * Resolves the origin this checkout's web app defaults to. Bootstrap derives a
 * per-worktree `BETTER_AUTH_URL` into `apps/web/.env`, and the dev server and
 * the Playwright suite must follow it: the auth server builds emailed action
 * links from that variable, and a session cookie set on one origin is
 * invisible to another. Reading the file rather than `process.env` keeps CI —
 * which exports the variable without writing an env file — on its explicit
 * configuration. It lives under `src/test` because the Playwright config and
 * `scripts/dev.ts` both import it and this is the shared location vitest
 * covers.
 */

const betterAuthUrlLine = /^\s*(?:export\s+)?BETTER_AUTH_URL\s*=\s*(.*)$/;

/** The `BETTER_AUTH_URL` an env file names, or undefined when it has none. */
export function envFileWebOrigin(content: string): string | undefined {
  for (const line of content.split("\n")) {
    const match = betterAuthUrlLine.exec(line);
    if (!match) {
      continue;
    }
    const value = unquote((match[1] ?? "").trim());
    if (value !== "") {
      return value;
    }
  }
  return undefined;
}

export function resolveWebOrigin(
  override: string | undefined,
  envFileContent: string | undefined,
): string {
  if (override !== undefined && override !== "") {
    return override;
  }

  const fromFile =
    envFileContent === undefined ? undefined : envFileWebOrigin(envFileContent);
  return fromFile ?? "http://localhost:3000";
}

function unquote(value: string): string {
  const first = value.charAt(0);
  return value.length >= 2 &&
    (first === '"' || first === "'") &&
    value.endsWith(first)
    ? value.slice(1, -1)
    : value;
}
