"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { authClient } from "~/server/better-auth/client";

/**
 * Ends the session and sends the visitor back to the landing page.
 *
 * `refresh()` follows the navigation because every page that reads the session
 * is a server component: without it the router cache would replay the signed-in
 * render of a page the visitor no longer has a session for.
 */
export function SignOutButton() {
  const t = useTranslations("app.userMenu");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => {
        setIsPending(true);
        void authClient.signOut().then(() => {
          router.push("/");
          router.refresh();
        });
      }}
      size="sm"
      type="button"
      variant="secondary"
    >
      {isPending ? t("signingOut") : t("signOut")}
    </Button>
  );
}
