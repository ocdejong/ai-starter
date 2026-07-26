import { coveredVitestConfig } from "@ai-starter/config/vitest/base";

/**
 * The deterministic rules a product is built on: no network, no clock, no
 * database, and nothing that cannot be reached from a test. The floor is the
 * whole file because there is no honest reason for a branch here to go
 * unexercised.
 */
export default coveredVitestConfig({
  branches: 100,
  functions: 100,
  lines: 100,
  statements: 100,
});
