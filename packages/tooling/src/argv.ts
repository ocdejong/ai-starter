export type ParsedArguments = {
  readonly flags: ReadonlyMap<string, string>;
  readonly switches: ReadonlySet<string>;
};

export class ArgumentError extends Error {}

/**
 * Accepts `--key value`, `--key=value` and bare `--switch` for the fixed set of
 * option names each command declares. Unknown options fail immediately so a
 * typo never silently falls back to a default.
 */
export function parseArguments(
  argv: readonly string[],
  options: {
    readonly flags: readonly string[];
    readonly switches: readonly string[];
  },
): ParsedArguments {
  const flags = new Map<string, string>();
  const switches = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";

    if (!argument.startsWith("--")) {
      throw new ArgumentError(`Unexpected argument "${argument}".`);
    }

    const separator = argument.indexOf("=");
    const name = (
      separator === -1 ? argument.slice(2) : argument.slice(2, separator)
    ).trim();

    if (options.switches.includes(name)) {
      if (separator !== -1) {
        throw new ArgumentError(`--${name} does not take a value.`);
      }
      switches.add(name);
      continue;
    }

    if (!options.flags.includes(name)) {
      throw new ArgumentError(`Unknown option "--${name}".`);
    }

    if (separator !== -1) {
      flags.set(name, argument.slice(separator + 1));
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new ArgumentError(`--${name} requires a value.`);
    }
    flags.set(name, value);
    index += 1;
  }

  return { flags, switches };
}
