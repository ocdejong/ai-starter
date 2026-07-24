export type VerifyEmailState = "confirmed" | "failed" | "pending";

/**
 * What the confirmation screen is being asked to show.
 *
 * The screen is reached two ways and has to tell them apart. Sign-up navigates
 * to it with `sent`, meaning "we mailed a link, go open it". Better Auth's own
 * redirect arrives after it has already verified the address and carries no
 * parameters at all — or an `error` when the token was expired or reused.
 */
export function verifyEmailState(params: {
  readonly error?: string | undefined;
  readonly sent?: string | undefined;
}): VerifyEmailState {
  if (params.error !== undefined && params.error !== "") {
    return "failed";
  }

  return params.sent === undefined || params.sent === ""
    ? "confirmed"
    : "pending";
}
