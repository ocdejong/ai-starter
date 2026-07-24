import { createDatabaseClient } from "@ai-starter/db";
import { describe, expect, it } from "vitest";

import { initAuth, type AuthEmailDispatchers } from "./init-auth";

const noopDispatchers: AuthEmailDispatchers = {
  sendChangeEmailVerification: () => undefined,
  sendDeleteAccountVerification: () => undefined,
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

  it("registers the expo plugin even when no plugins are appended", () => {
    const auth = build([]);

    const ids = (auth.options.plugins ?? []).map((plugin) => plugin.id);

    expect(ids).toEqual(["expo"]);
  });

  it("requires email verification and revokes sessions on password reset", () => {
    const auth = build([]);

    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(
      true,
    );
  });
});
