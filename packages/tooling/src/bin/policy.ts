import { checkNativeFlowPolicy } from "../native-flow-policy.ts";
import {
  checkRepositoryPolicy,
  formatViolations,
  summarise,
} from "../repository-policy.ts";
import { repositoryRoot } from "../repository.ts";
import { checkSuppressionRatchet } from "../suppression-ratchet.ts";
import { checkTranslationPolicy } from "../translation-policy.ts";
import { checkWorkflowPolicy } from "../workflow-policy.ts";

const usage = `Usage: pnpm policy

Checks the structural rules the module graph cannot see: workspace dependency
allowlists, public export surfaces, strict compiler flags in every tsconfig,
vendor SDK locations, silenced guardrails, generated-client cleanliness, the
verification scripts, the build task's environment and the error-reporting
gates, plus the repository-host half — commit-pinned actions,
least-privilege workflow permissions, checksummed downloads, a branch ruleset
whose required checks can actually report, and one pnpm lifecycle-script
allowlist — plus the native flows, whose application id and asserted copy are
all a machine without a simulator can check, plus the ratchet over the two
suppressions that cannot be banned outright — a described \`@ts-expect-error\` and
a justified \`eslint-disable\` — whose recorded counts may only shrink, plus the
translations, where a message identical to the English one is untranslated until
an allowance says why. Each failure names the file and the edit that fixes it.
\`pnpm arch\` covers the import-graph half.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  // Five checkers, one command: `checkRepositoryPolicy` owns what the workspace
  // is, `checkWorkflowPolicy` owns what the repository host and the supply chain
  // are allowed to do, `checkNativeFlowPolicy` owns the one journey no runner can
  // execute, `checkSuppressionRatchet` owns what is still allowed to look away,
  // and `checkTranslationPolicy` owns whether the copy a locale ships is that
  // locale's. They stay separate modules because a fixture that proves one has no
  // reason to carry the others' files, and `pnpm policy` is still the single
  // entry point all five reach the reader through.
  const violations = [
    ...checkRepositoryPolicy(repositoryRoot),
    ...checkWorkflowPolicy(repositoryRoot),
    ...checkNativeFlowPolicy(repositoryRoot),
    ...checkSuppressionRatchet(repositoryRoot),
    ...checkTranslationPolicy(repositoryRoot),
  ];

  if (violations.length > 0) {
    console.error(formatViolations(violations));
    process.exitCode = 1;
  }

  console.log(summarise(violations));
}
