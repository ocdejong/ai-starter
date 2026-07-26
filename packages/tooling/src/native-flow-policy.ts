import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { type PolicyViolation } from "./policy-violation.ts";

/**
 * What a Maestro flow can be checked for without a simulator.
 *
 * `pnpm verify` cannot run the native journey: a GitHub-hosted runner has no
 * device, and neither does a Mac with only the command-line tools. Nothing ran
 * `.maestro/smoke.yaml` for two stages, and it drifted silently — so these
 * checks run everywhere the rest of `pnpm policy` does. They prove the flow
 * still addresses this application and still quotes copy the product ships.
 * They cannot prove a screen is reachable; only a device can, which is why
 * `pnpm test:e2e:mobile` stays the env-gated step beside them.
 *
 * These are line predicates, not a YAML parser, for the reason
 * `workflow-policy.ts` records: `packages/tooling` may import no installed
 * dependency, and a checker that never blocks a change for the wrong reason is
 * worth more than one that understands every valid document.
 */

const flowDirectory = "apps/mobile/.maestro";
const appManifest = "apps/mobile/app.json";
const catalogPath = "packages/i18n/messages/en.json";

/** Commands whose argument is text a person reads on the screen. */
const copyCommands = new Set([
  "assertNotVisible",
  "assertVisible",
  "inputText",
  "tapOn",
]);

/** A quoted or bare scalar following `- <command>:` on one line. */
const commandLine = /^\s*-?\s*([A-Za-z]+):\s*(\S.*?)\s*$/;

/**
 * Shapes that make a Maestro selector a pattern rather than copy. Deliberately
 * narrower than the full metacharacter set: a sentence ends in `.` and asks with
 * `?`, and copy carries parentheses, so treating those as regular expressions
 * would exempt almost every real assertion from the catalog check.
 */
const regularExpressionShapes = /\.[*+]|[[\]^$|\\]/;

export function checkNativeFlowPolicy(root: string): PolicyViolation[] {
  const directory = path.join(root, flowDirectory);
  if (!existsSync(directory)) {
    return [
      {
        file: flowDirectory,
        fix: "Restore the native smoke flow, or remove the `test:e2e:mobile` step that runs it.",
        problem:
          "The repository declares a native journey but has no Maestro flow.",
      },
    ];
  }

  const flows = readdirSync(directory).filter((entry) =>
    /\.ya?ml$/.test(entry),
  );
  if (flows.length === 0) {
    return [
      {
        file: flowDirectory,
        fix: "Restore the native smoke flow, or remove the `test:e2e:mobile` step that runs it.",
        problem:
          "The repository declares a native journey but has no Maestro flow.",
      },
    ];
  }

  const identifiers = applicationIdentifiers(root);
  const copy = catalogValues(root);

  return flows.flatMap((flow) =>
    checkFlow(path.join(directory, flow), `${flowDirectory}/${flow}`, {
      copy,
      identifiers,
    }),
  );
}

function checkFlow(
  absolute: string,
  file: string,
  known: { copy: ReadonlySet<string>; identifiers: ReadonlySet<string> },
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const lines = readFileSync(absolute, "utf8").split("\n");
  let asserted = 0;

  lines.forEach((line, index) => {
    const match = commandLine.exec(line);
    if (match === null) {
      return;
    }

    const [, command = "", rawValue = ""] = match;
    const location = `${file}:${index + 1}`;

    if (command === "appId") {
      const declared = unquote(rawValue);
      if (known.identifiers.size > 0 && !known.identifiers.has(declared)) {
        violations.push({
          file: location,
          fix: `Set appId to the application's own identifier from ${appManifest}: ${[...known.identifiers].sort().join(" or ")}.`,
          problem: `The flow drives "${declared}", which this application no longer installs as.`,
        });
      }
      return;
    }

    if (!copyCommands.has(command)) {
      return;
    }

    // `tapOn:` followed by a nested `id:`/`text:` block carries no scalar here.
    if (rawValue === "" || rawValue.startsWith("{")) {
      return;
    }

    const value = unquote(rawValue);
    if (command !== "inputText") {
      asserted += 1;
    }

    if (regularExpressionShapes.test(value) || known.copy.has(value)) {
      return;
    }

    violations.push({
      file: location,
      fix: `Assert copy the product ships: add "${value}" to ${catalogPath}, or quote the message the screen now renders.`,
      problem: `The flow expects "${value}", which is not a message in ${catalogPath}.`,
    });
  });

  if (asserted === 0) {
    violations.push({
      file,
      fix: "Assert at least one message the launched screen renders, so a broken launch fails the flow.",
      problem:
        "The flow asserts nothing, so it passes even when the app shows the wrong screen.",
    });
  }

  return violations;
}

/** The identifiers the app installs as, from its own Expo manifest. */
function applicationIdentifiers(root: string): Set<string> {
  const manifest = readJson(path.join(root, appManifest));
  const expo = record(manifest).expo;
  const found = new Set<string>();

  for (const [platform, key] of [
    ["android", "package"],
    ["ios", "bundleIdentifier"],
  ] as const) {
    const value = record(record(expo)[platform])[key];
    if (typeof value === "string") {
      found.add(value);
    }
  }

  return found;
}

/** Every string a message catalog can render, at any nesting depth. */
function catalogValues(root: string): Set<string> {
  const found = new Set<string>();
  collectStrings(readJson(path.join(root, catalogPath)), found);
  return found;
}

function collectStrings(value: unknown, found: Set<string>): void {
  if (typeof value === "string") {
    found.add(value);
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    collectStrings(nested, found);
  }
}

function readJson(absolute: string): unknown {
  if (!existsSync(absolute)) {
    return {};
  }
  return JSON.parse(readFileSync(absolute, "utf8"));
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(["'])(.*)\1$/.exec(trimmed);
  return quoted?.[2] ?? trimmed;
}
