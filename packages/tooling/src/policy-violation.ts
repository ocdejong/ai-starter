/**
 * One structural problem, stated so a reader can fix it without re-deriving the
 * rule. `pnpm policy` collects these from every checker and prints them all.
 */
export type PolicyViolation = {
  /** Repository-relative file the reader has to open, optionally `:line`. */
  readonly file: string;
  readonly problem: string;
  /** The exact next edit that resolves it. */
  readonly fix: string;
};
