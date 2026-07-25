import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The browser's Better Auth client.
 *
 * The `organization` plugin is the client half of the server plugin the auth
 * factory installs: it types the group endpoints, keeps the group list and the
 * active group in stores that refresh themselves after each group mutation, and
 * exposes `checkRolePermission`, which answers from the same access-control
 * definition the server enforces with. Reading a role through it is what stops a
 * rendered affordance and the request behind it from drifting apart — the server
 * remains the boundary either way.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export type Session = typeof authClient.$Infer.Session;
