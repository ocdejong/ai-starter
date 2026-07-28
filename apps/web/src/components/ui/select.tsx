import * as React from "react";

import { cn } from "~/lib/utils";

/**
 * A plain HTML select, styled to match `Input`.
 *
 * The native control is deliberate: it is keyboard- and screen-reader-correct
 * everywhere without a listbox implementation behind it, and it opens as the
 * platform's own picker on a touch device. Reach for a custom listbox only when
 * an option needs to be richer than its label.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
