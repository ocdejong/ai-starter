/**
 * The named arguments an ICU message reads, so two locales can be compared by
 * what they interpolate rather than by what they say.
 *
 * A regular expression cannot answer this. `{count, plural, =0 {Saved} …}` has
 * two brace pairs and only the first one names an argument; the second opens a
 * submessage, whose text happens to be a single word and so reads exactly like
 * an argument name. A message that interpolates inside a branch —
 * `other {# for {name}}` — is the same problem from the other side: the argument
 * is real and nested. Both need the position, not the shape, so this walks the
 * message the way a formatter does.
 *
 * Deliberately not a full ICU parser: apostrophe quoting (`'{'` for a literal
 * brace) is not handled, because no catalog in this repository needs it and a
 * parser nobody exercises is worse than a documented limit. A quoted brace would
 * be read as an argument here.
 */
export function icuArguments(message: string): Set<string> {
  const names = new Set<string>();
  scanMessage(message, 0, names);
  return names;
}

/**
 * Reads message text from `start` until the message ends — at the closing brace
 * of the submessage that contains it, or at the end of the string. Returns the
 * index it stopped at.
 */
function scanMessage(
  message: string,
  start: number,
  names: Set<string>,
): number {
  let index = start;

  while (index < message.length) {
    const character = message[index];
    if (character === "}") {
      return index;
    }
    index = character === "{" ? scanArgument(message, index, names) : index + 1;
  }

  return index;
}

/** Reads one `{…}` argument, including any submessages its style contains. */
function scanArgument(
  message: string,
  start: number,
  names: Set<string>,
): number {
  let index = skipWhitespace(message, start + 1);

  const name = readToken(message, index);
  if (name.length > 0) {
    names.add(name);
  }
  index = skipWhitespace(message, index + name.length);

  if (message[index] !== ",") {
    // `{name}` — or something malformed, which the formatter reports far better
    // than a comparison of arguments could. Either way the brace is consumed,
    // because a scanner that does not advance does not terminate.
    return index + 1;
  }

  index = skipWhitespace(message, index + 1);
  const type = readToken(message, index);
  index = skipWhitespace(message, index + type.length);

  return selectorTypes.has(type)
    ? scanSelectors(message, index, names)
    : skipToClose(message, index);
}

/** The argument types whose style is a list of `selector {submessage}` pairs. */
const selectorTypes = new Set(["plural", "select", "selectordinal"]);

/**
 * Reads the `selector {submessage}` list of a plural or select, from the comma
 * that introduces it. A token with no brace after it — `offset:1` — is consumed
 * and the list continues.
 */
function scanSelectors(
  message: string,
  start: number,
  names: Set<string>,
): number {
  let index =
    message[start] === "," ? skipWhitespace(message, start + 1) : start;

  while (index < message.length) {
    const character = message[index];
    if (character === "}") {
      return index + 1;
    }

    if (character === "{") {
      index = scanMessage(message, index + 1, names);
      index = message[index] === "}" ? index + 1 : index;
      index = skipWhitespace(message, index);
      continue;
    }

    const token = readToken(message, index);
    index = skipWhitespace(message, index + Math.max(token.length, 1));
  }

  return index;
}

/** Skips a style this scanner does not read into — `date`, `number` and friends. */
function skipToClose(message: string, start: number): number {
  let depth = 1;
  let index = start;

  while (index < message.length) {
    const character = message[index];
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
    index += 1;
  }

  return index;
}

/** Everything up to the next delimiter: an argument name, a type, a selector. */
function readToken(message: string, start: number): string {
  let end = start;
  while (end < message.length && !/[\s,{}]/.test(message[end] ?? "")) {
    end += 1;
  }
  return message.slice(start, end);
}

function skipWhitespace(message: string, start: number): number {
  let index = start;
  while (index < message.length && /\s/.test(message[index] ?? "")) {
    index += 1;
  }
  return index;
}
