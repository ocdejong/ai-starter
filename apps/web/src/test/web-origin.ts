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

/**
 * Explains why this checkout must not drive the origin it resolved, or
 * undefined when the origin is its own. A linked worktree still naming the
 * example's origin never had one derived — `pnpm bootstrap` wrote its `.env`
 * before it did that, or never ran here — and every sibling in that state names
 * the same one. Playwright would then reuse whichever checkout's dev server
 * reached the port first and assert against a different product, which reads as
 * a suite of real failures rather than a misconfigured checkout. Refusing costs
 * one run; the alternative cost a morning.
 */
export function sharedWebOriginError(
  origin: string,
  exampleOrigin: string | undefined,
  linkedWorktree: boolean,
): string | undefined {
  if (!linkedWorktree || origin !== exampleOrigin) {
    return undefined;
  }

  return [
    `This worktree resolves the web origin ${origin}, which is the value every`,
    "checkout shares until bootstrap derives its own. Running the browser suite",
    "here would reuse a sibling worktree's dev server and assert against its",
    "application. Run `pnpm bootstrap` to derive this worktree's origin, or set",
    "E2E_BASE_URL together with BETTER_AUTH_URL to choose one explicitly.",
  ].join(" ");
}

function unquote(value: string): string {
  const first = value.charAt(0);
  return value.length >= 2 &&
    (first === '"' || first === "'") &&
    value.endsWith(first)
    ? value.slice(1, -1)
    : value;
}
