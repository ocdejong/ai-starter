import { readFileSync } from "node:fs";
import path from "node:path";

/** This module lives at `packages/tooling/src`, three levels below the repository root. */
export const repositoryRoot = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
);

export function repositoryPath(...segments: readonly string[]): string {
  return path.join(repositoryRoot, ...segments);
}

/** Repository-relative locations shared by the diagnostics and the bootstrapper. */
export const webEnvPath = "apps/web/.env";
export const mobileEnvPath = "apps/mobile/.env";
export const prismaSchemaPath = "packages/db/prisma/schema.prisma";
export const generatedClientPath = "packages/db/generated/prisma";

export type RootManifest = {
  readonly requiredNodeRange: string | undefined;
  readonly packageManager: string | undefined;
};

/**
 * Reads only the two fields the diagnostics need. The manifest is repository
 * data rather than a product boundary, and `doctor` must run before any
 * dependency — including a schema library — is installed.
 */
export function readRootManifest(root: string): RootManifest {
  const parsed: unknown = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8"),
  );

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("package.json does not contain a JSON object.");
  }

  const manifest = parsed as Record<string, unknown>;
  const engines = manifest.engines;
  const nodeRange =
    typeof engines === "object" && engines !== null
      ? (engines as Record<string, unknown>).node
      : undefined;

  return {
    packageManager:
      typeof manifest.packageManager === "string"
        ? manifest.packageManager
        : undefined,
    requiredNodeRange: typeof nodeRange === "string" ? nodeRange : undefined,
  };
}
