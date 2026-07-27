import { ArgumentError, parseArguments } from "../argv.ts";
import { deriveProductIdentity, IdentityError } from "../product-identity.ts";
import { repositoryRoot } from "../repository.ts";
import { starterIdentity } from "../starter-identity.ts";
import {
  finalizeInitialization,
  handOverReadme,
  initializeStarter,
} from "../starter-init.ts";

const usage = `Usage: pnpm starter:init --name "<Product Name>" [--scope <npm-scope>] [--app-id <com.example.product>]

Replaces every starter identifier with the downstream product's identity:
workspace package scope, repository and database name, Expo name, slug and
scheme, the iOS bundle identifier, the Android package and the visible starter
text, then hands the README over to the product, relinks the workspace and
reformats the files whose line wrapping the rename changed. Run it once, then
run \`pnpm bootstrap\`.

  --name    Required. The product's display name, for example "Acme Notes".
  --scope   npm scope for workspace packages. Defaults to the slug of --name.
  --app-id  Reverse-DNS application identifier. Defaults to com.example.<slug>.`;

function main(): number {
  let parsed;
  try {
    parsed = parseArguments(process.argv.slice(2), {
      flags: ["app-id", "name", "scope"],
      switches: ["help"],
    });
  } catch (error) {
    if (error instanceof ArgumentError) {
      console.error(`${error.message}\n\n${usage}`);
      return 2;
    }
    throw error;
  }

  if (parsed.switches.has("help") || parsed.flags.size === 0) {
    console.log(usage);
    return parsed.switches.has("help") ? 0 : 2;
  }

  const name = parsed.flags.get("name");
  if (name === undefined) {
    console.error(`--name is required.\n\n${usage}`);
    return 2;
  }

  let product;
  try {
    product = deriveProductIdentity(
      {
        applicationId: parsed.flags.get("app-id"),
        name,
        scope: parsed.flags.get("scope"),
      },
      starterIdentity,
    );
  } catch (error) {
    if (error instanceof IdentityError) {
      console.error(`starter:init: ${error.message}`);
      return 2;
    }
    throw error;
  }

  console.log("starter:init: applying");
  console.log(`  name         ${product.displayName}`);
  console.log(`  slug         ${product.slug}`);
  console.log(`  npm scope    @${product.scope}`);
  console.log(`  application  ${product.applicationId}`);

  const result = initializeStarter(repositoryRoot, starterIdentity, product);

  if (result.matchedFiles === 0) {
    console.log(
      "starter:init: no starter identity found; this repository is already initialized.",
    );
    return 0;
  }

  console.log(`starter:init: rewrote ${result.changedFiles.length} file(s).`);

  if (result.residual.length > 0) {
    console.error("\nstarter:init failed: starter identity is still present:");
    for (const entry of result.residual) {
      if (entry.inPath) {
        console.error(`  ${entry.file}  (in the file name)`);
      }
      for (const occurrence of entry.occurrences) {
        console.error(
          `  ${entry.file}:${occurrence.line}:${occurrence.column}  ${occurrence.token}`,
        );
      }
    }
    console.error(
      "fix: rename the reported files and remove the remaining references, then run `pnpm starter:init` again.",
    );
    return 1;
  }

  console.log("starter:init: no starter identity remains.");

  const handover = handOverReadme(repositoryRoot, product);
  console.log(`starter:init: ${handover.message}`);

  const finalization = finalizeInitialization(repositoryRoot);
  console.log(`starter:init: ${finalization.message}`);
  if (!finalization.ok) {
    return 1;
  }

  console.log("starter:init: next, run `pnpm bootstrap`, then `pnpm verify`.");
  return 0;
}

process.exitCode = main();
