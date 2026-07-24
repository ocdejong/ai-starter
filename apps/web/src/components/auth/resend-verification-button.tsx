"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { authClient } from "~/server/better-auth/client";

/** Where a confirmation link lands: the page that explains a rejected token. */
export const verifyEmailCallbackUrl = "/verify-email";

type Status = "idle" | "sending" | "sent" | "failed";

/**
 * Sends another confirmation link to an address the visitor has already given
 * us. Every dead end in the sign-up and sign-in flows ends here, so a lost or
 * expired link never strands an account.
 */
export function ResendVerificationButton({ email }: { email: string }) {
  const t = useTranslations("auth.resend");
  const [status, setStatus] = useState<Status>("idle");

  if (status === "sent") {
    return <p className="text-muted-foreground text-sm">{t("sent")}</p>;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        disabled={status === "sending"}
        onClick={async () => {
          setStatus("sending");
          const { error } = await authClient.sendVerificationEmail({
            callbackURL: verifyEmailCallbackUrl,
            email,
          });
          setStatus(error ? "failed" : "sent");
        }}
        type="button"
        variant="outline"
      >
        {status === "sending" ? t("sending") : t("action")}
      </Button>
      {status === "failed" && (
        <p className="text-destructive text-sm" role="alert">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
