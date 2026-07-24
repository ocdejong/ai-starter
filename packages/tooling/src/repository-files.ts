import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Directories that are generated, installed, or hold build output — plus
 * `.claude`, where coding agents keep local state and nested worktrees.
 * Rewriting them is pointless and, for `node_modules`, destructive.
 */
const skippedDirectories = new Set([
  ".claude",
  ".git",
  ".expo",
  ".next",
  ".turbo",
  "android",
  "build",
  "coverage",
  "dist",
  "generated",
  "ios",
  "node_modules",
  "playwright-report",
  "test-results",
  "web-build",
]);

/** Extensions whose bytes are not editable text but whose names still matter. */
const binaryExtensions = new Set([
  ".gif",
  ".icns",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".keystore",
  ".mp4",
  ".otf",
  ".pdf",
  ".png",
  ".svg",
  ".ttf",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const maximumFileSize = 8_000_000;

/**
 * Every repository-relative file path worth inspecting, including binary assets:
 * their names carry identity even when their bytes do not. Paths always use
 * forward slashes so callers can compare them on any platform.
 */
export function listFiles(root: string): string[] {
  const found: string[] = [];
  collect(root, root, found);
  return found.sort();
}

/** The subset of `listFiles` whose content the initializer may rewrite. */
export function listTextFiles(root: string): string[] {
  return listFiles(root).filter(isRewritableTextFile);
}

export function isRewritableTextFile(file: string): boolean {
  return !binaryExtensions.has(path.extname(file));
}

function collect(root: string, directory: string, found: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) {
        collect(root, absolute, found);
      }
      continue;
    }

    if (!entry.isFile() || statSync(absolute).size > maximumFileSize) {
      continue;
    }

    found.push(toRepositoryPath(root, absolute));
  }
}

export function toRepositoryPath(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join("/");
}

/** Returns the file content, or `undefined` when the bytes are not text. */
export function readTextFile(absolute: string): string | undefined {
  const content = readFileSync(absolute);
  const probe = content.subarray(0, 8000);
  return probe.includes(0) ? undefined : content.toString("utf8");
}
