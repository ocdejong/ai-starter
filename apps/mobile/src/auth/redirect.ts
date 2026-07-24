/** Where the router currently is, reduced to the three facts the gate needs. */
export type AuthRouteState = {
  /** True while the SecureStore-backed session is still being read. */
  readonly pending: boolean;
  readonly signedIn: boolean;
  /** `useSegments()` output: the route group first, the screen last. */
  readonly segments: readonly string[];
};

const authGroup = "(auth)";

/**
 * Screens a signed-in user has no business on. `reset-password` and
 * `verify-email` are excluded on purpose: both are opened from an email link and
 * stay valid for a signed-in user, so pushing them away would break the link.
 */
const credentialScreens = new Set(["forgot-password", "sign-in", "sign-up"]);

/** The only two routes the gate ever sends someone to. */
export type AuthRedirect = "/" | "/sign-in";

/**
 * The gate's whole decision, kept pure so every branch is provable without a
 * router, a navigator or a stored session.
 */
export function resolveAuthRedirect(
  state: AuthRouteState,
): AuthRedirect | null {
  if (state.pending) {
    return null;
  }

  const inAuthGroup = state.segments[0] === authGroup;

  if (!state.signedIn) {
    return inAuthGroup ? null : "/sign-in";
  }

  const screen = state.segments[state.segments.length - 1];
  return screen !== undefined && credentialScreens.has(screen) ? "/" : null;
}
