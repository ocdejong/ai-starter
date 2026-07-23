import { DatabaseUrlError, parseDatabaseUrl } from "./database-url.ts";

/**
 * `prisma db push` writes the schema straight to a database with no migration
 * and no review, so it is a prototyping tool that must never touch a shared or
 * deployed one. This decides, from the connection string alone, whether the
 * target is unmistakably the developer's own machine.
 */
export type LocalDatabaseVerdict =
  | { readonly local: true; readonly host: string }
  | { readonly local: false; readonly reason: string };

/**
 * Only loopback counts. `localhost` and the `127.0.0.0/8` block always reach
 * this machine, `.localhost` is reserved for it (RFC 6761), and `::1` is its
 * IPv6 form. Everything else — including a bare hostname that might resolve
 * anywhere — is treated as remote, because the check must fail closed.
 */
export function isLocalDatabaseHost(host: string): boolean {
  const normalised = host.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

  return (
    normalised === "localhost" ||
    normalised.endsWith(".localhost") ||
    normalised === "::1" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalised)
  );
}

export function checkLocalDatabase(
  databaseUrl: string | undefined,
): LocalDatabaseVerdict {
  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    return {
      local: false,
      reason: "DATABASE_URL is not set, so the target cannot be proven local.",
    };
  }

  let host: string;
  try {
    host = parseDatabaseUrl(databaseUrl).host;
  } catch (error) {
    return {
      local: false,
      reason:
        error instanceof DatabaseUrlError
          ? error.message
          : `DATABASE_URL could not be parsed: ${String(error)}`,
    };
  }

  return isLocalDatabaseHost(host)
    ? { host, local: true }
    : {
        local: false,
        reason: `DATABASE_URL points at ${host}, which is not a local database.`,
      };
}
