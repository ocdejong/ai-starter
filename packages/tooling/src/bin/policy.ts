import {
  checkRepositoryPolicy,
  formatViolations,
  summarise,
} from "../repository-policy.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm policy

Checks the structural rules the module graph cannot see: workspace dependency
allowlists, public export surfaces, strict compiler flags in every tsconfig,
vendor SDK locations, silenced guardrails, generated-client cleanliness and the
verification scripts. Each failure names the file and the edit that fixes it.
\`pnpm arch\` covers the import-graph half.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  const violations = checkRepositoryPolicy(repositoryRoot);

  if (violations.length > 0) {
    console.error(formatViolations(violations));
    process.exitCode = 1;
  }

  console.log(summarise(violations));
}
