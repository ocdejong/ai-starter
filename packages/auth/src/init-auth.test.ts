import { createDatabaseClient } from "@ai-starter/db";
import { describe, expect, it } from "vitest";

import { initAuth, type AuthEmailDispatchers } from "./init-auth";

const noopDispatchers: AuthEmailDispatchers = {
  sendChangeEmailVerification: () => undefined,
  sendDeleteAccountVerification: () => undefined,
  sendGroupInvitation: () => undefined,
  sendPasswordReset: () => undefined,
  sendVerification: () => undefined,
};

// Constructing the client does not open a connection, so these assertions about
// the assembled configuration need no database.
const build = (plugins: { id: string }[]) =>
  initAuth({
    baseURL: "http://localhost:3000",
    database: createDatabaseClient("postgresql://localhost:5432/unused"),
    email: noopDispatchers,
    plugins,
    trustedOrigins: ["ai-starter://"],
  });

describe("initAuth", () => {
  it("keeps composition-root plugins after expo so nextCookies stays last", () => {
    const auth = build([{ id: "next-cookies" }]);

    const ids = (auth.options.plugins ?? []).map((plugin) => plugin.id);

    expect(ids).toContain("expo");
    expect(ids.at(-1)).toBe("next-cookies");
  });

  it("registers the group and expo plugins even when none are appended", () => {
    const auth = build([]);

    const ids = (auth.options.plugins ?? []).map((plugin) => plugin.id);

    expect(ids).toEqual(["organization", "expo"]);
  });

  it("makes the group creator an owner and expires invitations", () => {
    const auth = build([]);

    const groups = (auth.options.plugins ?? []).find(
      (plugin) => plugin.id === "organization",
    );

    expect(groups?.options).toMatchObject({
      cancelPendingInvitationsOnReInvite: true,
      creatorRole: "owner",
      invitationExpiresIn: 48 * 60 * 60,
      requireEmailVerificationOnInvitation: true,
    });
  });

  it("requires email verification and revokes sessions on password reset", () => {
    const auth = build([]);

    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(
      true,
    );
  });
});
