import {
  desiredRepositorySettings,
  type BypassActor,
  type RulesetDefinition,
  rulesetDrift,
  rulesetPayload,
  secretScanningPayload,
  secretScanningState,
  settingsDrift,
} from "./repository-host.ts";

/**
 * The side-effecting half of `pnpm repo:host`: read what the host currently
 * says, compare it with the checkout, and write only the difference.
 *
 * Every write is preceded by the read that justifies it, which is what makes a
 * second run issue no writes at all. `--dry-run` records the same requests
 * without sending them, so the plan can be reviewed — and so the command stays
 * useful on an account whose plan refuses the ruleset API outright.
 */

export const defaultApiBaseUrl = "https://api.github.com";

export type RecordedRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
};

export type GitHubResponse = {
  readonly status: number;
  readonly body: unknown;
  /** GitHub's own explanation, or an empty string when it offered none. */
  readonly message: string;
};

export type GitHubClient = {
  request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<GitHubResponse>;
  readonly sent: readonly RecordedRequest[];
};

function messageOf(body: unknown): string {
  if (typeof body === "object" && body !== null) {
    const message = (body as Record<string, unknown>).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "";
}

export function createGitHubClient(options: {
  readonly baseUrl: string;
  readonly token: string;
}): GitHubClient {
  const sent: RecordedRequest[] = [];

  return {
    async request(method, path, body) {
      sent.push({ body: body ?? null, method, path });

      const response = await fetch(`${options.baseUrl}${path}`, {
        // `null`, not `undefined`: `exactOptionalPropertyTypes` rejects an
        // optional property explicitly set to undefined, and fetch reads null
        // as "no body" just the same.
        body: body === undefined ? null : JSON.stringify(body),
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${options.token}`,
          "content-type": "application/json",
          "user-agent": "ai-starter-repo-host",
          "x-github-api-version": "2022-11-28",
        },
        method,
      });

      const text = await response.text();
      let parsed: unknown = null;
      if (text.trim().length > 0) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      return {
        body: parsed,
        message: messageOf(parsed),
        status: response.status,
      };
    },
    sent,
  };
}

export type StepOutcome = "unchanged" | "applied" | "planned" | "failed";

export type HostStep = {
  readonly name: string;
  readonly outcome: StepOutcome;
  readonly detail: string;
};

export type HostReport = {
  readonly repository: string;
  readonly steps: readonly HostStep[];
  /** Everything the run sent, or would have sent under `--dry-run`. */
  readonly planned: readonly RecordedRequest[];
};

export type ApplyOptions = {
  readonly client: GitHubClient;
  readonly repository: string;
  readonly definitions: readonly RulesetDefinition[];
  readonly codeScanning: boolean;
  readonly bypassActor: BypassActor | undefined;
  readonly dryRun: boolean;
};

/** Names why a refusal happened in the terms the reader can act on. */
function remediation(response: GitHubResponse): string {
  if (
    response.status === 403 &&
    /Upgrade to GitHub Pro/i.test(response.message)
  ) {
    return `${response.message} (make the repository public, or upgrade the account).`;
  }
  if (response.status === 404) {
    return `${response.message || "Not found"} — check the repository name and that the token carries the \`repo\` scope.`;
  }
  return response.message || `HTTP ${String(response.status)}`;
}

function ok(response: GitHubResponse): boolean {
  return response.status >= 200 && response.status < 300;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function applyRepositoryHost(
  options: ApplyOptions,
): Promise<HostReport> {
  const { client, repository } = options;
  const steps: HostStep[] = [];
  const planned: RecordedRequest[] = [];

  /** Sends a write, or records it and reports it as planned under `--dry-run`. */
  const write = async (
    name: string,
    method: string,
    path: string,
    body: unknown,
    reason: string,
  ): Promise<void> => {
    planned.push({ body: body ?? null, method, path });

    if (options.dryRun) {
      steps.push({ detail: reason, name, outcome: "planned" });
      return;
    }

    const response = await client.request(method, path, body);
    steps.push(
      ok(response)
        ? { detail: reason, name, outcome: "applied" }
        : { detail: remediation(response), name, outcome: "failed" },
    );
  };

  const repositoryResponse = await client.request(
    "GET",
    `/repos/${repository}`,
  );
  if (!ok(repositoryResponse)) {
    return {
      planned,
      repository,
      steps: [
        {
          detail: remediation(repositoryResponse),
          name: "Read repository",
          outcome: "failed",
        },
      ],
    };
  }

  const current = asRecord(repositoryResponse.body);

  const drift = settingsDrift(desiredRepositorySettings, current);
  if (Object.keys(drift).length === 0) {
    steps.push({
      detail: "merge methods and branch cleanup already match",
      name: "Merge settings",
      outcome: "unchanged",
    });
  } else {
    await write(
      "Merge settings",
      "PATCH",
      `/repos/${repository}`,
      drift,
      Object.entries(drift)
        .map(([key, value]) => `${key} → ${String(value)}`)
        .join(", "),
    );
  }

  const secrets = secretScanningState(current);
  if (secrets.scanning && secrets.pushProtection) {
    steps.push({
      detail: "scanning and push protection already on",
      name: "Secret scanning",
      outcome: "unchanged",
    });
  } else {
    await write(
      "Secret scanning",
      "PATCH",
      `/repos/${repository}`,
      secretScanningPayload,
      "enable scanning and push protection",
    );
  }

  await toggle(
    "Dependabot alerts",
    `/repos/${repository}/vulnerability-alerts`,
    (response) => response.status === 204,
  );
  await toggle(
    "Dependabot security updates",
    `/repos/${repository}/automated-security-fixes`,
    (response) => asRecord(response.body).enabled === true,
  );
  await toggle(
    "Private vulnerability reporting",
    `/repos/${repository}/private-vulnerability-reporting`,
    (response) => asRecord(response.body).enabled === true,
  );

  const existing = await client.request("GET", `/repos/${repository}/rulesets`);
  if (!ok(existing)) {
    steps.push({
      detail: remediation(existing),
      name: "Branch ruleset",
      outcome: "failed",
    });
    for (const definition of options.definitions) {
      planned.push({
        body: rulesetPayload(definition, {
          bypassActor: options.bypassActor,
          codeScanning: options.codeScanning,
        }),
        method: "POST",
        path: `/repos/${repository}/rulesets`,
      });
    }
    return { planned, repository, steps };
  }

  const known = new Map<string, number>();
  for (const entry of Array.isArray(existing.body) ? existing.body : []) {
    const record = asRecord(entry);
    if (typeof record.name === "string" && typeof record.id === "number") {
      known.set(record.name, record.id);
    }
  }

  for (const definition of options.definitions) {
    const payload = rulesetPayload(definition, {
      bypassActor: options.bypassActor,
      codeScanning: options.codeScanning,
    });
    const name = `Ruleset "${definition.name}"`;
    const id = known.get(definition.name);

    if (id === undefined) {
      await write(
        name,
        "POST",
        `/repos/${repository}/rulesets`,
        payload,
        `create it from ${definition.file}`,
      );
      continue;
    }

    const detailed = await client.request(
      "GET",
      `/repos/${repository}/rulesets/${String(id)}`,
    );
    if (!ok(detailed)) {
      steps.push({ detail: remediation(detailed), name, outcome: "failed" });
      continue;
    }

    const differences = rulesetDrift(payload, asRecord(detailed.body));
    if (differences.length === 0) {
      steps.push({
        detail: `already matches ${definition.file}`,
        name,
        outcome: "unchanged",
      });
      continue;
    }

    await write(
      name,
      "PUT",
      `/repos/${repository}/rulesets/${String(id)}`,
      payload,
      differences.join("; "),
    );
  }

  return { planned, repository, steps };

  /** A switch GitHub exposes as PUT/DELETE with a GET that answers yes or no. */
  async function toggle(
    name: string,
    path: string,
    isEnabled: (response: GitHubResponse) => boolean,
  ): Promise<void> {
    const response = await client.request("GET", path);

    if (ok(response) && isEnabled(response)) {
      steps.push({ detail: "already enabled", name, outcome: "unchanged" });
      return;
    }
    if (!ok(response) && response.status !== 404) {
      steps.push({ detail: remediation(response), name, outcome: "failed" });
      return;
    }

    await write(name, "PUT", path, undefined, "enable it");
  }
}

export function formatReport(report: HostReport): string {
  const symbol: Readonly<Record<StepOutcome, string>> = {
    applied: "applied  ",
    failed: "FAILED   ",
    planned: "would    ",
    unchanged: "unchanged",
  };

  return report.steps
    .map((step) => `${symbol[step.outcome]}  ${step.name}: ${step.detail}`)
    .join("\n");
}

export function formatPlan(report: HostReport): string {
  return report.planned
    .map(
      (request) =>
        `${request.method} ${request.path}\n${
          request.body === null ? "  (no body)" : indent(request.body)
        }`,
    )
    .join("\n\n");
}

function indent(body: unknown): string {
  return JSON.stringify(body, null, 2)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
