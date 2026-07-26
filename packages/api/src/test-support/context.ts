import type { TRPCContext } from "../context";

/**
 * A port method no test provided.
 *
 * Returning an empty result instead would let a procedure test pass while
 * silently reading from a repository the test never set up, so an unprovided
 * port fails loudly and names itself. `() => never` is assignable to every
 * method signature on every port, which is what keeps this cast-free.
 */
function absent(port: string, method: string): () => never {
  return () => {
    throw new Error(
      `This test did not provide the ${port} repository, but ${port}.${method} was called.`,
    );
  };
}

/**
 * Every port the tRPC context carries, inert.
 *
 * A feature adds a port, and without this every existing router test would stop
 * compiling — the breakage stage 09 saw when the session grew a field, once per
 * feature forever. `pnpm generate feature` adds its entry here, so a router test
 * declares only the port it is about.
 */
const inertPorts = {
  announcements: {
    listByGroup: absent("announcements", "listByGroup"),
    publish: absent("announcements", "publish"),
    rename: absent("announcements", "rename"),
  },
  groups: {
    findMembership: absent("groups", "findMembership"),
    listMembers: absent("groups", "listMembers"),
    listMemberships: absent("groups", "listMemberships"),
  },
};

/**
 * Builds a context for a procedure test: every port present and inert, a signed-out
 * session, and whatever the test replaces.
 */
export function testContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    ...inertPorts,
    headers: new Headers(),
    session: null,
    ...overrides,
  };
}
