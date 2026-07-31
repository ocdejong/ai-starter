/**
 * The token `pnpm db:seed` passes once it has proven the target database is on
 * this machine. Its value is arbitrary; what matters is that only the wrapper
 * that ran the check sends it.
 */
export const localSeedAcknowledgement = "confirmed-local";

/** The variable the wrapper carries it in. */
export const localSeedAcknowledgementVariable = "AI_STARTER_SEED_LOCAL_CHECKED";

/**
 * Carries the connection string on the allowed branch so the caller reaches a
 * checked value rather than re-narrowing the one it passed in.
 */
export type DemoSeedPlan =
  | { readonly run: true; readonly databaseUrl: string }
  | { readonly run: false; readonly message: string };

/**
 * Whether this process may seed the demo account.
 *
 * The demo password is public documentation, so the account may exist only in a
 * database on the developer's own machine. `pnpm db:seed` proves that from the
 * connection string and refuses otherwise — but it proves it in the wrapper,
 * and the runtime half is a package script anyone can call directly, which is
 * the hole this closes.
 *
 * It re-reads the wrapper's verdict rather than re-deriving it: the host test
 * has one owner in `packages/tooling`, and a second copy here would be a second
 * thing to keep true. Deriving it again would also be weaker than it looks —
 * a tunnelled production database is reached at `localhost` like any other.
 */
export function planDemoSeed({
  acknowledgement,
  databaseUrl,
}: {
  readonly acknowledgement: string | undefined;
  readonly databaseUrl: string | undefined;
}): DemoSeedPlan {
  if (databaseUrl === undefined || databaseUrl === "") {
    return {
      message:
        "DATABASE_URL is not set. Run `pnpm db:seed` from the repository root, which loads apps/web/.env.",
      run: false,
    };
  }

  if (acknowledgement !== localSeedAcknowledgement) {
    return {
      message:
        "the demo account's credentials are public documentation, so this only runs behind the local-database check. Run `pnpm db:seed` from the repository root instead of this package's script.",
      run: false,
    };
  }

  return { databaseUrl, run: true };
}
