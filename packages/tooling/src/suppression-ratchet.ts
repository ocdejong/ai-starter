import { readFileSync } from "node:fs";
import path from "node:path";

import { type PolicyViolation } from "./policy-violation.ts";
import { listFiles } from "./repository-files.ts";

/**
 * A ratchet over every way this repository is still allowed to tell a checker to
 * look away.
 *
 * The bypasses that can be banned outright already are: `pnpm policy` rejects
 * `@ts-ignore` and `@ts-nocheck` in product sources, and ESLint rejects a
 * skipped test, a focused one and a laundered assertion everywhere. What is left
 * is the pair that cannot be banned without lying — a `@ts-expect-error` that
 * documents a genuine upstream defect, and an `eslint-disable` that carries a
 * reason. Both are legitimate; both are also how a codebase accumulates blind
 * spots one justified exception at a time.
 *
 * So they are counted rather than forbidden, against a list that may only
 * shrink. The comparison is exact in both directions on purpose: removing a
 * suppression without lowering the number leaves a budget nobody spent, and a
 * budget nobody spent is one the next change quietly does.
 *
 * Two deliberate consequences. Test files count, unlike in the bypass checker —
 * a suppression in a test is exactly where nobody looks. And a fixture that
 * *plants* a suppression to prove a checker fires counts too, which is why every
 * entry carries a reason: the number alone cannot tell those apart, and a reader
 * deserves to know which is which without opening the file.
 */

export type SuppressionAllowance = {
  /** Repository-relative file. */
  readonly file: string;
  /** Exactly how many suppression comments it may contain. */
  readonly count: number;
  /** Why they are there. Prose for the reader; nothing compares it. */
  readonly reason: string;
};

export const allowedSuppressions: readonly SuppressionAllowance[] = [
  {
    count: 1,
    file: "apps/mobile/jest.setup.ts",
    reason:
      "A jest.mock factory cannot use `import`, so the require it needs is disabled with a reason.",
  },
  {
    count: 1,
    file: "apps/mobile/src/i18n/messages.test.tsx",
    reason:
      "The typed-key probe: the `@ts-expect-error` is the assertion. If the catalog augmentation lapses, the directive stops being used and typecheck fails.",
  },
  {
    count: 1,
    file: "apps/web/src/i18n/messages.test.tsx",
    reason: "The web half of the same typed-key probe.",
  },
  {
    count: 1,
    file: "packages/config/eslint/rules.test.ts",
    reason:
      "A planted stale disable directive, proving `reportUnusedDisableDirectives` is an error rather than a warning.",
  },
  {
    count: 5,
    file: "packages/tooling/src/repository-policy.test.ts",
    reason:
      "Planted violations inside string fixtures, proving the bypass checker reports an undescribed directive and accepts a justified one.",
  },
  {
    count: 5,
    file: "packages/tooling/src/suppression-ratchet.test.ts",
    reason:
      "This ratchet's own planted fixtures. Nothing here silences a checker; each is a string the counter below is asked to recognise.",
  },
];

const suppressionExtensions = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

/** A directive only silences anything inside a comment, matching the bypass checker. */
const typeDirective =
  /(?:\/\/|\/\*|^\s*\*)\s*@ts-(?:ignore|nocheck|expect-error)\b/;
const lintDirective = /(?:\/\/|\/\*)\s*eslint-disable(?:-next-line|-line)?\b/;

export function countSuppressions(root: string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const file of listFiles(root)) {
    if (!suppressionExtensions.has(path.extname(file))) {
      continue;
    }

    let found = 0;
    for (const line of readFileSync(path.join(root, file), "utf8").split(
      "\n",
    )) {
      if (typeDirective.test(line)) {
        found += 1;
      }
      if (lintDirective.test(line)) {
        found += 1;
      }
    }

    if (found > 0) {
      counts.set(file, found);
    }
  }

  return counts;
}

const ratchetModule = "packages/tooling/src/suppression-ratchet.ts";

export function checkSuppressionRatchet(root: string): PolicyViolation[] {
  const counted = countSuppressions(root);
  const allowed = new Map(
    allowedSuppressions.map((entry) => [entry.file, entry.count]),
  );
  const violations: PolicyViolation[] = [];

  for (const [file, found] of [...counted].sort()) {
    const budget = allowed.get(file);

    if (budget === undefined) {
      violations.push({
        file,
        fix: `Remove the suppression, or — if it is genuinely the smallest honest change — add { count: ${String(found)}, file: "${file}", reason: … } to allowedSuppressions in ${ratchetModule}.`,
        problem: `${String(found)} suppression(s) here, and this file has no allowance.`,
      });
      continue;
    }

    if (found > budget) {
      violations.push({
        file,
        fix: `Remove ${String(found - budget)} of them, or raise this file's allowance in ${ratchetModule} and say in its reason what the new one is for.`,
        problem: `${String(found)} suppression(s) here, against an allowance of ${String(budget)}.`,
      });
    }
  }

  for (const entry of allowedSuppressions) {
    const found = counted.get(entry.file) ?? 0;
    if (found < entry.count) {
      violations.push({
        file: ratchetModule,
        fix: `Set ${entry.file} to ${String(found)}${found === 0 ? " — or drop its entry entirely" : ""}.`,
        problem: `${entry.file} is allowed ${String(entry.count)} suppression(s) and now carries ${String(found)}. A ratchet only counts if an improvement is recorded.`,
      });
    }
  }

  return violations;
}
