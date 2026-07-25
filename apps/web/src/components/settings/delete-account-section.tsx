"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  SettingsError,
  SettingsNotice,
  settingsRequestOutcome,
  type SettingsErrorCode,
} from "~/components/settings/settings-error";
import { SettingsSection } from "~/components/settings/settings-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/server/better-auth/client";

/**
 * Deleting the account, which this button only ever *asks* for.
 *
 * The auth server is configured to answer a deletion request with an emailed
 * link and to delete nothing until that link is opened, so the reader is told in
 * as many words that nothing has gone yet. Typing the account's own address
 * first is the guard against a mis-click; the email is the guard against someone
 * else sitting at an unlocked screen.
 */
export function DeleteAccountSection({ email }: { email: string }) {
  const t = useTranslations("app.settings.danger");
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<SettingsErrorCode | null>(null);
  const [requested, setRequested] = useState(false);
  const [pending, setPending] = useState(false);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function request() {
    setError(null);
    setPending(true);
    const failure = await settingsRequestOutcome(() =>
      // Where the emailed link lands once the deletion is done: the account it
      // belonged to no longer exists, so the only honest destination is the
      // public front page.
      authClient.deleteUser({ callbackURL: "/" }),
    );
    setPending(false);

    if (failure !== null) {
      setError(failure);
      return;
    }
    setConfirming(false);
    setTyped("");
    setRequested(true);
  }

  return (
    <SettingsSection
      description={t("description")}
      id="danger-settings"
      title={t("title")}
      tone="danger"
    >
      {requested ? (
        <SettingsNotice>{t("sent", { email })}</SettingsNotice>
      ) : null}
      <SettingsError code={error} />
      {confirming ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirmation">{t("confirmLabel")}</Label>
            <p
              className="text-muted-foreground text-sm"
              id="delete-instruction"
            >
              {t("confirmInstruction", { email })}
            </p>
            <Input
              aria-describedby="delete-instruction"
              autoComplete="off"
              id="delete-confirmation"
              onChange={(event) => {
                setTyped(event.target.value);
              }}
              type="email"
              value={typed}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!matches || pending}
              onClick={() => void request()}
              type="button"
              variant="destructive"
            >
              {pending ? t("confirming") : t("confirm")}
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
                setTyped("");
                setError(null);
              }}
              type="button"
              variant="outline"
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => {
            setRequested(false);
            setConfirming(true);
          }}
          type="button"
          variant="destructive"
        >
          {t("delete")}
        </Button>
      )}
    </SettingsSection>
  );
}
