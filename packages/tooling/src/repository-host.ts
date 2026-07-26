import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * The desired state of the repository host, derived from files in the checkout
 * rather than from anything a maintainer remembers. `.github/rulesets/*.json`
 * carries the branch ruleset verbatim; this module turns it into the requests
 * `pnpm repo:host` would send and decides which of them are already satisfied.
 *
 * Everything here is pure so the decisions can be tested without a network.
 */

export const rulesetDirectory = ".github/rulesets";

export type RulesetDefinition = {
  /** Repository-relative file the payload came from. */
  readonly file: string;
  readonly name: string;
  /** The verbatim body of POST /repos/{owner}/{repo}/rulesets. */
  readonly payload: Record<string, unknown>;
  /** Contexts held back until the repository can actually report them. */
  readonly advancedSecurityChecks: readonly string[];
};

export type RepositorySettings = Readonly<Record<string, boolean>>;

/**
 * Merge settings that make `required_linear_history` achievable: a merge commit
 * cannot produce linear history, so leaving it enabled offers a button the
 * ruleset refuses. Deleting the branch afterwards keeps the ref list honest.
 */
export const desiredRepositorySettings: RepositorySettings = {
  allow_merge_commit: false,
  allow_rebase_merge: true,
  allow_squash_merge: true,
  delete_branch_on_merge: true,
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export class RulesetError extends Error {}

/** Reads every checked-in ruleset, in file-name order. Each is applied by its own name. */
export function readRulesetDefinitions(root: string): RulesetDefinition[] {
  const directory = path.join(root, rulesetDirectory);
  if (!existsSync(directory)) {
    throw new RulesetError(
      `${rulesetDirectory} does not exist, so there is no ruleset to apply.`,
    );
  }

  const definitions: RulesetDefinition[] = [];

  for (const entry of readdirSync(directory).sort()) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    const file = `${rulesetDirectory}/${entry}`;
    const parsed: unknown = JSON.parse(
      readFileSync(path.join(directory, entry), "utf8"),
    );
    const payload = asRecord(asRecord(parsed)?.ruleset);
    if (payload === undefined || typeof payload.name !== "string") {
      throw new RulesetError(
        `${file} has no "ruleset" object with a "name"; \`pnpm policy\` explains the shape.`,
      );
    }

    const optional = asRecord(asRecord(parsed)?.requiresAdvancedSecurity);
    definitions.push({
      advancedSecurityChecks: asArray(optional?.requiredStatusChecks).filter(
        (context): context is string => typeof context === "string",
      ),
      file,
      name: payload.name,
      payload,
    });
  }

  if (definitions.length === 0) {
    throw new RulesetError(`${rulesetDirectory} contains no ruleset files.`);
  }

  return definitions;
}

export type BypassActor = {
  readonly actor_id: number;
  readonly actor_type: string;
  readonly bypass_mode: string;
};

export type PayloadOptions = {
  /** Adds the checks that only report with code scanning or a public repository. */
  readonly codeScanning: boolean;
  /** The one maintainer allowed past the ruleset, when the caller asked for one. */
  readonly bypassActor: BypassActor | undefined;
};

/**
 * The body to send. The checked-in file stays the strict truth: both the extra
 * required checks and any bypass are grafted on here, from an explicit flag, so
 * a weakening is visible in the command that caused it.
 */
export function rulesetPayload(
  definition: RulesetDefinition,
  options: PayloadOptions,
): Record<string, unknown> {
  const payload = structuredClone(definition.payload);

  if (options.bypassActor !== undefined) {
    payload.bypass_actors = [options.bypassActor];
  }

  if (options.codeScanning && definition.advancedSecurityChecks.length > 0) {
    payload.rules = asArray(payload.rules).map((rule) => {
      const record = asRecord(rule);
      if (record?.type !== "required_status_checks") {
        return rule;
      }
      const parameters = asRecord(record.parameters) ?? {};
      return {
        ...record,
        parameters: {
          ...parameters,
          required_status_checks: [
            ...asArray(parameters.required_status_checks),
            ...definition.advancedSecurityChecks.map((context) => ({
              context,
            })),
          ],
        },
      };
    });
  }

  return payload;
}

function sameValue(desired: unknown, actual: unknown): boolean {
  if (Array.isArray(desired)) {
    return (
      Array.isArray(actual) &&
      desired.length === actual.length &&
      desired.every((entry, index) => sameValue(entry, actual[index]))
    );
  }

  const desiredRecord = asRecord(desired);
  if (desiredRecord !== undefined) {
    const actualRecord = asRecord(actual);
    return (
      actualRecord !== undefined &&
      Object.entries(desiredRecord).every(([key, value]) =>
        sameValue(value, actualRecord[key]),
      )
    );
  }

  return desired === actual;
}

/**
 * What the host would have to change, stated per field. Empty means the ruleset
 * already says what the checkout says, which is what makes a second run a no-op.
 *
 * Only the keys the payload sets are compared. GitHub answers with an id, links
 * and timestamps that no checkout can predict, and treating those as drift would
 * make every run rewrite the ruleset.
 */
export function rulesetDrift(
  desired: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): string[] {
  if (existing === undefined) {
    return ["the ruleset does not exist yet"];
  }

  const drift: string[] = [];

  for (const [key, value] of Object.entries(desired)) {
    if (key === "rules") {
      drift.push(...rulesDrift(asArray(value), asArray(existing.rules)));
      continue;
    }
    if (!sameValue(value, existing[key])) {
      drift.push(`${key} differs`);
    }
  }

  return drift;
}

function rulesDrift(desired: unknown[], existing: unknown[]): string[] {
  const drift: string[] = [];
  const byType = new Map<string, Record<string, unknown>>();

  for (const rule of existing) {
    const record = asRecord(rule);
    if (record !== undefined && typeof record.type === "string") {
      byType.set(record.type, record);
    }
  }

  for (const rule of desired) {
    const record = asRecord(rule);
    const type = record?.type;
    if (record === undefined || typeof type !== "string") {
      continue;
    }

    const actual = byType.get(type);
    if (actual === undefined) {
      drift.push(`the ${type} rule is missing`);
      continue;
    }
    if (!sameValue(record.parameters ?? {}, actual.parameters ?? {})) {
      drift.push(`the ${type} rule has different parameters`);
    }
  }

  for (const type of byType.keys()) {
    const wanted = desired.some((rule) => asRecord(rule)?.type === type);
    if (!wanted) {
      drift.push(`the ${type} rule is not in the checked-in ruleset`);
    }
  }

  return drift.sort();
}

/** The repository settings that differ from what the checkout asks for. */
export function settingsDrift(
  desired: RepositorySettings,
  current: Record<string, unknown>,
): RepositorySettings {
  return Object.fromEntries(
    Object.entries(desired).filter(([key, value]) => current[key] !== value),
  );
}

export type SecretScanningState = {
  readonly scanning: boolean;
  readonly pushProtection: boolean;
};

/** Reads the two secret-scanning switches out of a repository response. */
export function secretScanningState(
  repository: Record<string, unknown>,
): SecretScanningState {
  const analysis = asRecord(repository.security_and_analysis);
  const status = (key: string): boolean =>
    asRecord(analysis?.[key])?.status === "enabled";

  return {
    pushProtection: status("secret_scanning_push_protection"),
    scanning: status("secret_scanning"),
  };
}

export const secretScanningPayload = {
  security_and_analysis: {
    secret_scanning: { status: "enabled" },
    secret_scanning_push_protection: { status: "enabled" },
  },
};

const remoteUrl = /(?:git@[^:]+:|https?:\/\/[^/]+\/)([^/]+)\/(.+?)(?:\.git)?$/;

/** Turns any form of GitHub remote URL into `owner/name`. */
export function parseRepositorySlug(url: string): string | undefined {
  const match = remoteUrl.exec(url.trim());
  const owner = match?.[1];
  const name = match?.[2];
  return owner === undefined || name === undefined
    ? undefined
    : `${owner}/${name}`;
}
