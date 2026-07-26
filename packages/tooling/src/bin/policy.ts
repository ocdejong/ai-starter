import { checkNativeFlowPolicy } from "../native-flow-policy.ts";
import {
  checkRepositoryPolicy,
  formatViolations,
  summarise,
} from "../repository-policy.ts";
import { repositoryRoot } from "../repository.ts";
import { checkWorkflowPolicy } from "../workflow-policy.ts";

const usage = `Usage: pnpm policy

Checks the structural rules the module graph cannot see: workspace dependency
allowlists, public export surfaces, strict compiler flags in every tsconfig,
vendor SDK locations, silenced guardrails, generated-client cleanliness and the
verification scripts, plus the repository-host half — commit-pinned actions,
least-privilege workflow permissions, checksummed downloads, a branch ruleset
whose required checks can actually report, and one pnpm lifecycle-script
allowlist — plus the native flows, whose application id and asserted copy are
all a machine without a simulator can check. Each failure names the file and the
edit that fixes it. \`pnpm arch\` covers the import-graph half.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  // Three checkers, one command: `checkRepositoryPolicy` owns what the workspace
  // is, `checkWorkflowPolicy` owns what the repository host and the supply chain
  // are allowed to do, and `checkNativeFlowPolicy` owns the one journey no
  // runner can execute. They stay separate modules because a fixture that proves
  // one has no reason to carry the others' files, and `pnpm policy` is still the
  // single entry point all three reach the reader through.
  const violations = [
    ...checkRepositoryPolicy(repositoryRoot),
    ...checkWorkflowPolicy(repositoryRoot),
    ...checkNativeFlowPolicy(repositoryRoot),
  ];

  if (violations.length > 0) {
    console.error(formatViolations(violations));
    process.exitCode = 1;
  }

  console.log(summarise(violations));
}
