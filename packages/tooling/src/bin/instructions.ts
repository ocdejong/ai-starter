import {
  checkInstructionSurfaces,
  formatViolations,
  instructionSurfaces,
  summarise,
  writeVendorPointers,
} from "../instruction-policy.ts";
import { checkCommand, writeCommand } from "../instruction-surfaces.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm instructions [--write]

Checks that every agent instruction surface still points at the one contract:
${instructionSurfaces()
  .map((surface) => `  ${surface}`)
  .join("\n")}

Vendor pointers are generated, never hand-edited. \`${writeCommand}\` regenerates
them; \`${checkCommand}\` fails when a pointer is stale, a rule is duplicated
across surfaces, or a referenced document does not resolve.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else if (process.argv.includes("--write")) {
  const written = writeVendorPointers(repositoryRoot);

  console.log(
    written.length === 0
      ? "instructions: every vendor pointer was already up to date."
      : `instructions: regenerated ${written.join(", ")}.`,
  );
} else {
  const violations = checkInstructionSurfaces(repositoryRoot);

  if (violations.length > 0) {
    console.error(formatViolations(violations));
    process.exitCode = 1;
  }

  console.log(summarise(violations));
}
