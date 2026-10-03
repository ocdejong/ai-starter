// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Configuration validation belongs to the env tests; this reads the real Next
// configuration without asking for a complete environment.
vi.mock("../env.js", () => ({}));

import config from "../../next.config.js";

/**
 * The response headers every page carries.
 *
 * They are configuration, not code, and configuration that silently stops being
 * applied looks exactly like configuration that is: `next.config.js` can lose
 * its `headers()` block in a merge and every other test still passes. Reading
 * the exported configuration proves the block is there without starting a
 * server, which is what a browser journey would have to do to learn the same.
 */
describe("Next response security configuration", () => {
  it("applies the security headers to every route and omits the framework header", async () => {
    if (typeof config === "function" || config.headers === undefined) {
      throw new Error("Next must configure response headers.");
    }

    const rules = await config.headers();
    const allRoutes = rules.find((rule) => rule.source === "/:path*");

    // Clickjacking, in both the modern and the legacy spelling: the signed-in
    // screens carry destructive controls, and a framed page is how a click on
    // one gets stolen.
    expect(allRoutes?.headers).toEqual(
      expect.arrayContaining([
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
        },
      ]),
    );

    // The framework's version is a free hint to anyone matching known
    // advisories against the deployment.
    expect(config.poweredByHeader).toBe(false);
  });
});
