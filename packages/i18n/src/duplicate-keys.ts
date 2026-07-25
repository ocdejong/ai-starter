/**
 * Dotted paths of every key that repeats within one object level anywhere in
 * a JSON document, in source order. `JSON.parse` keeps only the last
 * occurrence of a repeated key, so a duplicated namespace silently shadows
 * the earlier one — only the raw text can reveal it. Throws `SyntaxError` on
 * text that is not valid JSON.
 */
export function findDuplicateKeyPaths(text: string): string[] {
  const duplicates: string[] = [];
  let index = 0;

  function fail(expected: string): never {
    const found =
      index < text.length ? `"${text.charAt(index)}"` : "end of input";
    throw new SyntaxError(
      `Expected ${expected} at position ${String(index)} but found ${found}.`,
    );
  }

  function skipWhitespace(): void {
    while (index < text.length && " \t\n\r".includes(text.charAt(index))) {
      index += 1;
    }
  }

  /** Consumes one string token and returns its escape-decoded value. */
  function parseString(): string {
    if (text.charAt(index) !== '"') {
      fail("a string");
    }
    const start = index;
    index += 1;
    while (index < text.length && text.charAt(index) !== '"') {
      // An escape never ends the string; skipping its next character is safe
      // because every JSON escape continues with at least one more character.
      index += text.charAt(index) === "\\" ? 2 : 1;
    }
    if (index >= text.length) {
      fail("a closing quote");
    }
    index += 1;
    // Delegate escape decoding to JSON.parse so key equality matches it exactly.
    const decoded: unknown = JSON.parse(text.slice(start, index));
    if (typeof decoded !== "string") {
      fail("a string");
    }
    return decoded;
  }

  function parseObject(path: string): void {
    index += 1; // consume "{"
    const seen = new Set<string>();
    skipWhitespace();
    if (text.charAt(index) === "}") {
      index += 1;
      return;
    }
    for (;;) {
      skipWhitespace();
      const key = parseString();
      const keyPath = path === "" ? key : `${path}.${key}`;
      if (seen.has(key)) {
        duplicates.push(keyPath);
      }
      seen.add(key);
      skipWhitespace();
      if (text.charAt(index) !== ":") {
        fail('":"');
      }
      index += 1;
      skipWhitespace();
      parseValue(keyPath);
      skipWhitespace();
      const next = text.charAt(index);
      if (next === ",") {
        index += 1;
        continue;
      }
      if (next === "}") {
        index += 1;
        return;
      }
      fail('"," or "}"');
    }
  }

  function parseArray(path: string): void {
    index += 1; // consume "["
    skipWhitespace();
    if (text.charAt(index) === "]") {
      index += 1;
      return;
    }
    for (let element = 0; ; element += 1) {
      skipWhitespace();
      parseValue(`${path}[${String(element)}]`);
      skipWhitespace();
      const next = text.charAt(index);
      if (next === ",") {
        index += 1;
        continue;
      }
      if (next === "]") {
        index += 1;
        return;
      }
      fail('"," or "]"');
    }
  }

  function parseValue(path: string): void {
    const next = text.charAt(index);
    if (next === "{") {
      parseObject(path);
    } else if (next === "[") {
      parseArray(path);
    } else if (next === '"') {
      parseString();
    } else {
      const start = index;
      while (
        index < text.length &&
        !",}] \t\n\r".includes(text.charAt(index))
      ) {
        index += 1;
      }
      const literal = text.slice(start, index);
      if (
        !/^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(literal)
      ) {
        index = start;
        fail("a JSON value");
      }
    }
  }

  skipWhitespace();
  parseValue("");
  skipWhitespace();
  if (index < text.length) {
    fail("end of input");
  }
  return duplicates;
}
