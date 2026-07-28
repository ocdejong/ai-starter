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

/**
 * The reverse of the edits above.
 *
 * Every one of them works by *pattern* rather than by reconstructing the text a
 * generator once wrote, and that is the whole design. Removal runs in a product
 * that has been living with the slice: it has renamed the schema, reworded a
 * comment, added a field. Matching what the generator would emit today would
 * quietly skip exactly the registrations somebody has touched, which is the
 * subset most likely to be left behind.
 */

/** Removes a whole `export … from "./module";` statement, however it wraps. */
export function removeReexport(content: string, module: string): string {
  const pattern = new RegExp(
    `^export [^;]*?from "${module.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}";\\n`,
    "m",
  );
  return content.replace(pattern, "");
}

/**
 * Removes names from a braced import or export list, and the statement itself
 * once nothing is left in it.
 */
export function removeBraceListNames(
  content: string,
  pattern: RegExp,
  removals: readonly string[],
): string {
  const match = pattern.exec(content);
  if (match?.[1] === undefined) {
    return content;
  }

  const kept = match[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !removals.includes(entry));

  if (kept.length === 0) {
    return content.replace(`${match[0]}\n`, "").replace(match[0], "");
  }

  return content.replace(
    match[0],
    match[0].replace(match[1], ` ${kept.join(", ")} `),
  );
}

/**
 * Removes `key` and its value from the object literal that `opener` opens,
 * however many lines the value spans.
 */
export function removeObjectEntry(
  content: string,
  opener: string,
  key: string,
): string {
  const start = content.indexOf(opener);
  if (start === -1) {
    return content;
  }

  const body = start + opener.length;
  const lines = content.slice(body).split("\n");
  let depth = 0;
  let lineStart = body;

  for (const line of lines) {
    const trimmed = line.trim();
    if (depth === 0) {
      const existing = /^([A-Za-z_$][\w$]*)\s*[:,]/.exec(trimmed);
      if (existing?.[1] === key) {
        return `${content.slice(0, lineStart)}${content.slice(entryEnd(content, lineStart))}`;
      }
      if (trimmed.startsWith("}")) {
        return content;
      }
    }
    depth += (line.match(/[{[(]/g) ?? []).length;
    depth -= (line.match(/[}\])]/g) ?? []).length;
    lineStart += line.length + 1;
  }

  return content;
}

/** Where the entry beginning at `start` ends, counting its nested braces. */
function entryEnd(content: string, start: number): number {
  let depth = 0;
  let index = start;

  while (index < content.length) {
    const character = content[index] ?? "";
    if ("{[(".includes(character)) {
      depth += 1;
    } else if ("}])".includes(character)) {
      depth -= 1;
    } else if (character === "\n" && depth === 0) {
      return index + 1;
    }
    index += 1;
  }

  return content.length;
}

/** Removes every line containing `marker`. */
export function removeLinesContaining(content: string, marker: string): string {
  return content
    .split("\n")
    .filter((line) => !line.includes(marker))
    .join("\n");
}

/**
 * Where the documentation of the declaration at `start` begins.
 *
 * Both spellings count: a `/** … *\/` block and a run of `//` lines. The
 * composition root's wiring is documented with the second, so a helper that only
 * knew the first would delete the constant and leave two lines of comment
 * explaining a port that is no longer there.
 */
function commentAbove(content: string, start: number): number {
  const lines = content.slice(0, start).split("\n");
  // The last entry is whatever precedes the declaration on its own line.
  let index = lines.length - 1;

  while (index > 0) {
    const line = (lines[index - 1] ?? "").trim();
    if (line.startsWith("//")) {
      index -= 1;
      continue;
    }
    if (line.endsWith("*/")) {
      while (index > 0 && !(lines[index - 1] ?? "").trim().startsWith("/*")) {
        index -= 1;
      }
      index -= 1;
      continue;
    }
    break;
  }

  return lines.slice(0, index).join("\n").length + (index === 0 ? 0 : 1);
}

/**
 * Removes a top-level `export type X = …;` or `export const x = …;` together
 * with the documentation comment directly above it.
 */
export function removeDeclaration(
  content: string,
  declaration: string,
): string {
  const start = content.indexOf(declaration);
  if (start === -1) {
    return content;
  }

  const from = commentAbove(content, start);

  let depth = 0;
  let index = start;
  while (index < content.length) {
    const character = content[index] ?? "";
    if ("{[(".includes(character)) {
      depth += 1;
    } else if ("}])".includes(character)) {
      depth -= 1;
    } else if (character === ";" && depth === 0) {
      index += 1;
      break;
    }
    index += 1;
  }

  return `${content.slice(0, from)}${content.slice(index).replace(/^\n+/, "\n")}`;
}

/**
 * Removes the whole self-closing JSX element that contains `marker`.
 *
 * Deleting the marker's *line* is not enough, and the reason is stage 13's trap
 * seen from the other side: the generator guards on an attribute Prettier cannot
 * reflow, precisely because Prettier wraps the element across lines — so by the
 * time anything is removed, the attribute and the rest of the element are on
 * different lines. Taking the line leaves a `<Tabs.Screen>` with no name and a
 * translation key for a feature that is gone, which typechecks nowhere and is
 * reported as a message-key error rather than as a removal that half happened.
 */
export function removeJsxElementContaining(
  content: string,
  marker: string,
): string {
  const at = content.indexOf(marker);
  if (at === -1) {
    return content;
  }

  const open = content.lastIndexOf("<", at);
  const close = content.indexOf("/>", at);
  if (open === -1 || close === -1) {
    return content;
  }

  const lineStart = content.lastIndexOf("\n", open) + 1;
  const lineEnd = content.indexOf("\n", close);

  return `${content.slice(0, lineStart)}${lineEnd === -1 ? "" : content.slice(lineEnd + 1)}`;
}

/**
 * Removes the brace-delimited object literal that contains `marker`, and the
 * comma after it. Same reason as above: an entry long enough for Prettier to
 * wrap is an entry a line-based removal would leave half of.
 */
export function removeObjectLiteralContaining(
  content: string,
  marker: string,
): string {
  const at = content.indexOf(marker);
  if (at === -1) {
    return content;
  }

  const open = content.lastIndexOf("{", at);
  if (open === -1) {
    return content;
  }

  let depth = 0;
  let index = open;
  while (index < content.length) {
    const character = content[index] ?? "";
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    }
    index += 1;
  }

  const after = content[index + 1] === "," ? index + 2 : index + 1;
  const lineStart = content.lastIndexOf("\n", open) + 1;
  const lineEnd = content.indexOf("\n", after);
  const trailing = content
    .slice(after, lineEnd === -1 ? undefined : lineEnd)
    .trim();

  // Take the surrounding lines only when the entry had them to itself.
  return trailing.length === 0 &&
    content.slice(lineStart, open).trim().length === 0
    ? `${content.slice(0, lineStart)}${lineEnd === -1 ? "" : content.slice(lineEnd + 1)}`
    : `${content.slice(0, open)}${content.slice(after)}`;
}
