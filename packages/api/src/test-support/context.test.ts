import { describe, expect, it } from "vitest";

import { createTRPCContext } from "../context";
import { testContext } from "./context";

/**
 * The safety net's own behaviour. A procedure test that forgets to provide the
 * repository it reads from must fail loudly, because the alternative — an empty
 * result — is a test that passes while proving nothing. The refusal is thrown
 * synchronously rather than returned as a rejected promise, so it surfaces even
 * where a caller forgets to await.
 */
describe("testContext", () => {
  it("names the port and the method a test forgot to provide", () => {
    const context = testContext();

    expect(() => context.announcements.listByGroup("group-1")).toThrow(
      "announcements.listByGroup",
    );
    expect(() =>
      context.groups.findMembership({ groupId: "group-1", userId: "user-1" }),
    ).toThrow("groups.findMembership");
  });

  it("keeps a provided port and leaves the rest inert", async () => {
    const context = testContext({
      groups: {
        findMembership: () => Promise.resolve(null),
        listMembers: () => Promise.resolve([]),
        listMemberships: () => Promise.resolve([]),
      },
    });

    await expect(
      context.groups.findMembership({ groupId: "group-1", userId: "user-1" }),
    ).resolves.toBeNull();
    expect(() => context.announcements.listByGroup("group-1")).toThrow(
      "did not provide",
    );
  });

  it("starts signed out, so a test says when it is not", () => {
    expect(testContext().session).toBeNull();
  });
});

/**
 * The shared layer names the context's shape and derives nothing from it — every
 * port is bound at a composition root the application owns. This is what makes
 * that a contract rather than a convention nobody checks.
 */
describe("createTRPCContext", () => {
  it("hands back exactly the context the composition root built", () => {
    const context = testContext();

    expect(createTRPCContext(context)).toBe(context);
  });
});
