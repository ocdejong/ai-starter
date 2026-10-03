// @vitest-environment node
import type * as NodeFs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a linked worktree that never derived its own origin looks like on disk:
 * no `.env`, an example that names the origin every checkout shares, and a
 * `.git` that is a file. The real files are replaced because the checkout
 * running this test is itself bootstrapped.
 */
const sharedOrigin = "http://localhost:3000";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();
  // Read per call: the factory runs once, the tests switch the state.
  const unbootstrappedWorktree = () =>
    process.env.PLAYWRIGHT_CONFIG_TEST_WORKTREE === "shared";
  return {
    ...actual,
    readFileSync: (
      path: Parameters<typeof actual.readFileSync>[0],
      ...rest: unknown[]
    ) => {
      if (unbootstrappedWorktree() && String(path).endsWith(".env")) {
        throw new Error("ENOENT");
      }
      if (unbootstrappedWorktree() && String(path).endsWith(".env.example")) {
        return `BETTER_AUTH_URL="http://localhost:3000"\n`;
      }
      return (actual.readFileSync as (...args: unknown[]) => unknown)(
        path,
        ...rest,
      );
    },
    statSync: (
      path: Parameters<typeof actual.statSync>[0],
      ...rest: unknown[]
    ) => {
      if (unbootstrappedWorktree() && String(path).endsWith(".git")) {
        return { isFile: () => true };
      }
      return (actual.statSync as (...args: unknown[]) => unknown)(
        path,
        ...rest,
      );
    },
  };
});

const touched = [
  "CI",
  "E2E_BASE_URL",
  "E2E_USE_BUILD",
  "E2E_REUSE_SERVER",
  "E2E_PROVIDER_ORIGIN",
  "PLAYWRIGHT_CONFIG_TEST_WORKTREE",
] as const;
const saved = new Map(touched.map((name) => [name, process.env[name]]));

beforeEach(() => {
  vi.resetModules();
  for (const name of touched) {
    delete process.env[name];
  }
});

afterEach(() => {
  for (const [name, value] of saved) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

async function loadConfig() {
  const { default: config } = await import("../../playwright.config");
  return config;
}

describe("Playwright configuration", () => {
  it("never retries a journey, in CI or anywhere else", async () => {
    process.env.CI = "true";
    process.env.E2E_BASE_URL = "http://127.0.0.1:3000";

    expect((await loadConfig()).retries).toBe(0);
  });

  it("keeps a trace of every failure, since nothing is retried", async () => {
    expect((await loadConfig()).use?.trace).toBe("retain-on-failure");
  });

  /**
   * Every `page.request` call goes through Playwright's one keep-alive agent,
   * and `next start` closes an idle keep-alive socket after Node's five
   * seconds. A request that reuses the socket as it closes reads `ECONNRESET` —
   * on whichever journey happened to pause. A server that keeps a connection for
   * as long as the web job may run cannot close one under a request.
   */
  it("keeps the built server's idle connections open for the whole web job", async () => {
    process.env.CI = "true";
    process.env.E2E_BASE_URL = "http://127.0.0.1:3000";

    const config = await loadConfig();
    const servers = Array.isArray(config.webServer)
      ? config.webServer
      : [config.webServer];
    const web = servers.find((server) =>
      server?.command.startsWith("pnpm start"),
    );

    const timeout = Number(
      /--keepAliveTimeout (\d+)/.exec(web?.command ?? "")?.[1],
    );
    expect(timeout).toBeGreaterThanOrEqual(20 * 60_000);
  });

  // Adopting a running dev server is what a developer iterating wants, and what
  // `verify:changed` must not do: the port may answer for another product.
  it("adopts a running dev server unless told to start its own", async () => {
    process.env.E2E_BASE_URL = "http://127.0.0.1:3000";
    const reuse = async () => {
      const { default: config } = await import("../../playwright.config");
      const servers = Array.isArray(config.webServer)
        ? config.webServer
        : [config.webServer];
      return servers
        .filter((server) => server?.command.startsWith("pnpm dev"))
        .map((server) => server?.reuseExistingServer);
    };

    expect(await reuse()).toEqual([true]);

    vi.resetModules();
    delete process.env.E2E_PROVIDER_ORIGIN;
    process.env.E2E_REUSE_SERVER = "false";
    expect(await reuse()).toEqual([false]);
  });

  // The refusal used to run while the config loaded, and a config that throws
  // cannot be loaded by knip, which then drops its Playwright and Vitest entries
  // and reports false unused exports in every fresh worktree.
  it("loads in a linked worktree that never derived its own origin", async () => {
    process.env.PLAYWRIGHT_CONFIG_TEST_WORKTREE = "shared";

    await expect(loadConfig()).resolves.toMatchObject({
      use: { baseURL: sharedOrigin },
    });
  });

  it("refuses to start the suite there, naming the fix", async () => {
    process.env.PLAYWRIGHT_CONFIG_TEST_WORKTREE = "shared";
    const { default: globalSetup } =
      await import("../../e2e/support/global-setup");

    expect(() => {
      globalSetup();
    }).toThrow(/pnpm bootstrap/);
  });

  it("lets an explicit origin through, as the config always has", async () => {
    process.env.PLAYWRIGHT_CONFIG_TEST_WORKTREE = "shared";
    process.env.E2E_BASE_URL = "http://localhost:3123";
    const { default: globalSetup } =
      await import("../../e2e/support/global-setup");

    expect(() => {
      globalSetup();
    }).not.toThrow();
  });
});
