/**
 * A deliberately small `.env` reader and writer. It understands the quoting the
 * checked-in examples use and preserves comments and ordering when a value is
 * replaced, so bootstrap never reformats a developer's file.
 */

const assignmentPattern = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

export function parseEnvFile(content: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const line of content.split("\n")) {
    const match = assignmentPattern.exec(line);
    if (!match) {
      continue;
    }
    const [, key = "", rawValue = ""] = match;
    values.set(key, unquote(rawValue.trim()));
  }

  return values;
}

export function setEnvValue(
  content: string,
  key: string,
  value: string,
): string {
  const quoted = `${key}="${value}"`;
  const lines = content.split("\n");
  const index = lines.findIndex(
    (line) => assignmentPattern.exec(line)?.[1] === key,
  );

  if (index === -1) {
    const separator = content.endsWith("\n") || content === "" ? "" : "\n";
    return `${content}${separator}${quoted}\n`;
  }

  lines[index] = quoted;
  return lines.join("\n");
}

function unquote(value: string): string {
  const withoutComment =
    value.startsWith('"') || value.startsWith("'")
      ? value
      : value.replace(/\s+#.*$/, "");

  const first = withoutComment.charAt(0);
  if (
    withoutComment.length >= 2 &&
    (first === '"' || first === "'") &&
    withoutComment.endsWith(first)
  ) {
    return withoutComment.slice(1, -1);
  }

  return withoutComment;
}
