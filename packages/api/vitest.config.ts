import { coveredVitestConfig } from "@ai-starter/config/vitest/base";

/**
 * The floor is what this package already holds, not a round number. Two paths
 * are deliberately outside it: the tRPC error formatter, which only runs while
 * serialising an HTTP response and so cannot be reached through a caller, and
 * the development-only delay in the timing middleware. Raise these when a test
 * raises the measurement — never to make room for untested code.
 */
export default coveredVitestConfig({
  branches: 76.92,
  functions: 93.33,
  lines: 97.72,
  statements: 97.82,
});
