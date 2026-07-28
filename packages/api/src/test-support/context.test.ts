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
/*
 * Asserted through `groups`, which is the one port this repository always has.
 * A generated feature registers its own beside it and a product that removes the
 * example takes that one away again — so a case written against the example
 * would be a case that fails for a reason about the example rather than about
 * this mechanism.
 */
describe("testContext", () => {
  it("names the port and the method a test forgot to provide", () => {
    const context = testContext();

    expect(() => context.groups.listMembers("group-1")).toThrow(
      "groups.listMembers",
    );
    expect(() =>
      context.groups.findMembership({ groupId: "group-1", userId: "user-1" }),
    ).toThrow("groups.findMembership");
  });

  it("keeps a provided port", async () => {
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
    await expect(context.groups.listMembers("group-1")).resolves.toEqual([]);
  });

  it("refuses a port no test provided, rather than answering nothing", () => {
    expect(() => testContext().groups.listMemberships("user-1")).toThrow(
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
