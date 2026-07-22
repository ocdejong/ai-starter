export type DatabaseConnection = {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
};

export class DatabaseUrlError extends Error {}

const postgresProtocols = new Set(["postgres:", "postgresql:"]);

/**
 * Parses the single `DATABASE_URL` that Prisma, the local container and the
 * diagnostics all read, so none of them re-derives connection details.
 */
export function parseDatabaseUrl(value: string): DatabaseConnection {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DatabaseUrlError(
      `DATABASE_URL is not a valid URL: ${describe(value)}`,
    );
  }

  if (!postgresProtocols.has(url.protocol)) {
    throw new DatabaseUrlError(
      `DATABASE_URL must use postgresql://, not ${url.protocol}//.`,
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (database === "") {
    throw new DatabaseUrlError("DATABASE_URL does not name a database.");
  }

  return {
    database,
    host: url.hostname === "" ? "localhost" : url.hostname,
    password: decodeURIComponent(url.password),
    port: url.port === "" ? 5432 : Number(url.port),
    user: decodeURIComponent(url.username) || "postgres",
  };
}

/** Rewrites only the port so bootstrap can resolve a local collision in place. */
export function withPort(value: string, port: number): string {
  const url = new URL(value);
  url.port = String(port);
  return url.toString();
}

function describe(value: string): string {
  return value.length > 60 ? `${value.slice(0, 57)}...` : value;
}
