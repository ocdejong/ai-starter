import { coveredVitestConfig } from "@ai-starter/config/vitest/base";

/**
 * The floor is what this package already holds, not a round number. One path is
 * deliberately outside it: the tRPC error formatter, which only runs while
 * serialising an HTTP response and so cannot be reached through a caller —
 * reaching it means asserting through `_def._config`, which needs the laundering
 * cast the lint rules reject. Raise these when a test raises the measurement,
 * never to make room for untested code.
 *
 * They moved down once, by 0.05, when stage 16 deleted `publicProcedure`: an
 * export nothing reached, whose module-scope line counted as covered. The
 * uncovered set did not change — a smaller denominator did. A floor that
 * punishes deleting dead code is a floor arguing against the thing it is here
 * to protect, so it was re-measured rather than the deletion reversed.
 */
export default coveredVitestConfig({
  branches: 76.92,
  functions: 93.33,
  lines: 97.67,
  statements: 97.77,
});
