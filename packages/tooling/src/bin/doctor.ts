import { ArgumentError, parseArguments } from "../argv.ts";
import { formatChecks, hasFailure, runDiagnostics } from "../doctor.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm run doctor [--json]

Reports whether this machine and checkout can build, migrate and test the
repository, and names the exact command that resolves each problem.`;

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArguments(process.argv.slice(2), {
      flags: [],
      switches: ["help", "json"],
    });
  } catch (error) {
    if (error instanceof ArgumentError) {
      console.error(`${error.message}\n\n${usage}`);
      return 2;
    }
    throw error;
  }

  if (parsed.switches.has("help")) {
    console.log(usage);
    return 0;
  }

  const checks = await runDiagnostics(repositoryRoot);

  if (parsed.switches.has("json")) {
    console.log(JSON.stringify({ checks }, null, 2));
  } else {
    console.log(formatChecks(checks));
  }

  return hasFailure(checks) ? 1 : 0;
}

process.exitCode = await main();
