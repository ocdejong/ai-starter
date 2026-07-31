import { expect, test } from "@playwright/test";

/**
 * The response headers every page carries.
 *
 * These are configuration, not code, and configuration that silently stops
 * being applied looks exactly like configuration that is: `next.config.js` can
 * lose its `headers()` block in a merge and every unit test still passes. So
 * the assertion is made against a real response from the real server.
 */
test("serves the security headers on a page response", async ({ request }) => {
  const response = await request.get("/");

  expect(response.status()).toBe(200);

  // Clickjacking, in both the modern and the legacy spelling. The signed-in
  // group and account screens carry destructive controls, and a framed page is
  // how a click on one gets stolen.
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers()["x-frame-options"]).toBe("DENY");

  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(response.headers()["strict-transport-security"]).toContain("max-age=");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");

  // The framework's version is a free hint to anyone matching known advisories
  // against the deployment.
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});
