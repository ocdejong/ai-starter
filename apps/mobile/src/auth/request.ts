import {
  parseAuthValidationCode,
  type AuthValidationCode,
} from "@ai-starter/domain";

import { authErrorCode, authErrorKey, type AuthErrorKey } from "./errors";

/** A failed call, as both a translatable message and the raw server code. */
export type AuthFailure = {
  readonly key: AuthErrorKey;
  /** Present only when the server answered; absent for a transport failure. */
  readonly code: string | undefined;
};

/**
 * The two ways a Better Auth client call reports trouble, unified.
 *
 * A server that answers puts the problem in `{ error }`; a request that never
 * completes throws instead. Every screen needs both handled, so the branch lives
 * here once and each screen reads one failure — `null` meaning it succeeded. The
 * code is carried alongside the message key for the few outcomes that are a route
 * change rather than something to say.
 */
export async function authRequestOutcome(
  call: () => Promise<{ readonly error?: unknown }>,
): Promise<AuthFailure | null> {
  try {
    const { error } = await call();
    return error === null || error === undefined ? null : describe(error);
  } catch (thrown) {
    return describe(thrown);
  }
}

function describe(error: unknown): AuthFailure {
  return { code: authErrorCode(error), key: authErrorKey(error) };
}

/**
 * The validation code to show against each field, keyed by field name.
 *
 * The domain schemas report stable codes rather than prose because they cannot
 * reach a message catalog; this narrows each issue's message back to a known code
 * so the screen can translate it. An unrecognised message is kept as `null`,
 * which still marks the field invalid without asserting why.
 */
export function fieldValidationCodes(
  issues: readonly {
    readonly message: string;
    readonly path: readonly PropertyKey[];
  }[],
): ReadonlyMap<string, AuthValidationCode | null> {
  const codes = new Map<string, AuthValidationCode | null>();

  for (const issue of issues) {
    const [field] = issue.path;
    if (typeof field === "string" && !codes.has(field)) {
      codes.set(field, parseAuthValidationCode(issue.message));
    }
  }

  return codes;
}
