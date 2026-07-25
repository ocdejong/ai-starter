"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";

/**
 * A destructive action that asks first.
 *
 * The question replaces the button in place rather than opening a dialog: it
 * needs no focus trap to be usable with a keyboard or a screen reader, and the
 * consequence is written next to the control that causes it. Every irreversible
 * group action — removing someone, leaving, deleting — goes through this.
 */
export function ConfirmButton({
  busy,
  busyLabel,
  cancelLabel,
  confirmLabel,
  label,
  onConfirm,
  question,
}: {
  readonly busy: boolean;
  readonly busyLabel: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly label: string;
  readonly onConfirm: () => void;
  readonly question: string;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button
        onClick={() => {
          setAsking(true);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {label}
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{question}</span>
      <Button
        disabled={busy}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
        size="sm"
        type="button"
        variant="destructive"
      >
        {busy ? busyLabel : confirmLabel}
      </Button>
      <Button
        onClick={() => {
          setAsking(false);
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        {cancelLabel}
      </Button>
    </span>
  );
}
