"use client";

import { groupErrorFor, type GroupErrorCode } from "@ai-starter/domain";
import { useState } from "react";

/** What every group call on the auth client resolves to. */
type GroupCallResult = {
  readonly error: { readonly code?: string | undefined } | null;
};

/**
 * Runs one group mutation at a time and keeps what came back.
 *
 * The auth client answers with `{ data, error }` and does not throw for a
 * refusal, so a caller that ignores `error` reports success for a request the
 * server rejected. This funnels every call through the same place: the refusal
 * becomes a code the catalogs have copy for, a thrown network failure becomes
 * the generic one, and only a genuine success reaches `onChanged`.
 *
 * `pendingId` names which row or form is busy, so a list can disable the control
 * that was used rather than all of them.
 */
export function useGroupAction(onChanged: () => void) {
  const [error, setError] = useState<GroupErrorCode | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function run(id: string, call: () => Promise<GroupCallResult>): void {
    setError(null);
    setPendingId(id);
    void (async () => {
      try {
        const result = await call();
        if (result.error !== null) {
          setError(groupErrorFor(result.error.code));
          return;
        }
        onChanged();
      } catch {
        setError("unexpected");
      } finally {
        setPendingId(null);
      }
    })();
  }

  return { error, pendingId, run, setError };
}
