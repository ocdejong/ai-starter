/**
 * The text surgery the generators perform on files a feature has to register
 * itself in.
 *
 * Every helper is idempotent — running a generator twice is a no-op, not a
 * duplicate — and every helper throws when the thing it anchors on is gone, so a
 * refactor that moves a registry is reported as a named file and a named edit
 * rather than as a silently skipped registration.
 */

/**
 * Node runs this package by stripping types, which rejects parameter
 * properties — so the fields are assigned in the body.
 */
export class AnchorMissingError extends Error {
  readonly file: string;

  constructor(file: string, anchor: string, remedy: string) {
    super(`${file} no longer contains ${anchor}. ${remedy}`);
    this.name = "AnchorMissingError";
    this.file = file;
  }
}

function sortNames(names: readonly string[]): string[] {
  const bare = (entry: string) => entry.replace(/^type\s+/, "");
  return [...names].sort((left, right) => {
    const leftType = left.startsWith("type ");
    const rightType = right.startsWith("type ");
    if (leftType !== rightType) {
      return leftType ? 1 : -1;
    }
    return bare(left).localeCompare(bare(right));
  });
}

/**
 * Adds names to an existing braced import or export list.
 *
 * `pattern` must capture the list's contents and must not be able to match
 * across two statements — `[^{}]*` rather than `[\s\S]*?`, or the match starts
 * at an earlier import and swallows everything between the two. Prettier decides
 * afterwards whether the result fits on one line, so this only has to get the
 * names and their order right.
 */
export function mergeBraceList(
  file: string,
  content: string,
  pattern: RegExp,
  additions: readonly string[],
): string {
  const match = pattern.exec(content);
  if (match?.[1] === undefined) {
    throw new AnchorMissingError(
      file,
      `an import or export list matching ${pattern.source}`,
      `Add ${additions.join(", ")} to it by hand.`,
    );
  }

  const existing = match[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const missing = additions.filter((entry) => !existing.includes(entry));
  if (missing.length === 0) {
    return content;
  }

  const merged = sortNames([...existing, ...missing]).join(",\n  ");
  return content.replace(
    match[0],
    match[0].replace(match[1], `\n  ${merged},\n`),
  );
}

/**
 * Inserts a statement among the `export … from "./module"` lines of a package
 * index, in the sorted position the file already keeps them in.
 */
export function addSortedReexport(
  file: string,
  content: string,
  module: string,
  statement: string,
): string {
  if (content.includes(`from "${module}";`)) {
    return content;
  }

  const pattern = /^export [\s\S]*?from "(\.[^"]+)";$/gm;
  for (const match of content.matchAll(pattern)) {
    if ((match[1] ?? "") > module) {
      return `${content.slice(0, match.index)}${statement}\n${content.slice(match.index)}`;
    }
  }

  const last = [...content.matchAll(pattern)].at(-1);
  if (last === undefined) {
    throw new AnchorMissingError(
      file,
      "any re-export statement",
      `Add ${statement} by hand.`,
    );
  }
  const end = last.index + last[0].length;
  return `${content.slice(0, end)}\n${statement}${content.slice(end)}`;
}

/**
 * Inserts `entry` among the top-level keys of the object literal that `opener`
 * opens, keeping them in the order the file already uses.
 */
export function addObjectEntry(
  file: string,
  content: string,
  opener: string,
  entry: string,
): string {
  const key = entry.slice(0, entry.indexOf(":"));
  const start = content.indexOf(opener);
  if (start === -1) {
    throw new AnchorMissingError(
      file,
      `"${opener}"`,
      `Add "${entry}" to that object by hand.`,
    );
  }

  const body = start + opener.length;
  const lines = content.slice(body).split("\n");
  let depth = 0;
  // The absolute index of the first character of the line being read. The first
  // "line" is whatever follows the opener on its own line, so it starts here.
  let lineStart = body;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = line.slice(0, line.length - trimmed.length);
    const insert = (padding: string) =>
      `${content.slice(0, lineStart)}${padding}${entry}\n${content.slice(lineStart)}`;

    if (depth === 0) {
      const existing = /^([A-Za-z_$][\w$]*)\s*[:,]/.exec(trimmed);
      if (existing?.[1] === key) {
        return content;
      }
      if (existing !== null && (existing[1] ?? "") > key) {
        return insert(indent);
      }
      if (trimmed.startsWith("}")) {
        return insert(`${indent}  `);
      }
    }
    depth += (line.match(/[{[(]/g) ?? []).length;
    depth -= (line.match(/[}\])]/g) ?? []).length;
    lineStart += line.length + 1;
  }

  throw new AnchorMissingError(
    file,
    `the end of the object opened by "${opener}"`,
    `Add "${entry}" to it by hand.`,
  );
}

/**
 * Inserts `text` on the line after the one containing `anchor`.
 *
 * `marker` is what "already inserted" means. It cannot be the inserted text
 * itself: the generator runs Prettier afterwards, so by the second run the text
 * has been rewrapped and a textual comparison would insert it again. Pass
 * something Prettier cannot reflow — a single identifier or attribute.
 */
export function insertAfterLine(
  file: string,
  content: string,
  anchor: string,
  marker: string,
  text: string,
): string {
  if (content.includes(marker)) {
    return content;
  }

  const lines = content.split("\n");
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index === -1) {
    throw new AnchorMissingError(
      file,
      `"${anchor}"`,
      `Add the following after it by hand:\n${text}`,
    );
  }

  lines.splice(index + 1, 0, text);
  return lines.join("\n");
}

/**
 * Inserts `text` immediately before the line containing `anchor`. `marker` is
 * the Prettier-proof "already inserted" test; see `insertAfterLine`.
 */
export function insertBeforeLine(
  file: string,
  content: string,
  anchor: string,
  marker: string,
  text: string,
): string {
  if (content.includes(marker)) {
    return content;
  }

  const lines = content.split("\n");
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index === -1) {
    throw new AnchorMissingError(
      file,
      `"${anchor}"`,
      `Add the following before it by hand:\n${text}`,
    );
  }

  lines.splice(index, 0, text);
  return lines.join("\n");
}
