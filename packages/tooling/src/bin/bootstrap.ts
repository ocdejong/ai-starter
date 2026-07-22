import { BootstrapError, runBootstrap } from "../bootstrap.ts";
import { repositoryRoot } from "../repository.ts";

const usage = `Usage: pnpm bootstrap

Takes a clean checkout to a runnable, migrated local environment: environment
files, dependencies, the local PostgreSQL container, the generated Prisma
client and every committed migration. Safe to run repeatedly.`;

if (process.argv.includes("--help")) {
  console.log(usage);
} else {
  try {
    await runBootstrap(repositoryRoot);
  } catch (error) {
    if (error instanceof BootstrapError) {
      console.error(`\nbootstrap failed: ${error.message}\nfix: ${error.fix}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
