"use client";

import { type DeviceBrowser, type DevicePlatform } from "@ai-starter/domain";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  SettingsError,
  type SettingsErrorCode,
} from "~/components/settings/settings-error";
import { SettingsSection } from "~/components/settings/settings-section";
import { Button } from "~/components/ui/button";

/**
 * One session, as much of it as the browser is allowed to know.
 *
 * Deliberately absent: the session token. Better Auth's own listing returns it —
 * it is the handle its revoke endpoint takes — but a token is a bearer
 * credential, and the session cookie is `httpOnly` precisely so that a script on
 * this page cannot read one. Sending every device's token into the page would
 * hand all of them to any injected script. Revocation therefore travels by the
 * session's id and is resolved back to a token on the server.
 *
 * The timestamp arrives pre-formatted for the same reason the labels do not:
 * formatting it here would mean rendering one string on the server and another
 * in the browser, and a hydration mismatch is a poor way to learn about a clock.
 */
export type SessionView = {
  readonly browser: DeviceBrowser;
  readonly id: string;
  readonly isCurrent: boolean;
  readonly lastActive: string;
  readonly platform: DevicePlatform;
};

export function SessionsList({
  revokeOtherSessions,
  revokeSession,
  sessions,
}: {
  revokeOtherSessions: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
  sessions: readonly SessionView[];
}) {
  const t = useTranslations("app.settings.sessions");
  const router = useRouter();
  const [error, setError] = useState<SettingsErrorCode | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const others = sessions.filter((session) => !session.isCurrent);

  function describe({ browser, platform }: SessionView): string {
    return browser === "unknown" && platform === "unknown"
      ? t("unknownDevice")
      : t("device", {
          browser: t(`browser.${browser}`),
          platform: t(`platform.${platform}`),
        });
  }

  async function run(key: string, revoke: () => Promise<void>) {
    setError(null);
    setPending(key);
    try {
      await revoke();
      router.refresh();
    } catch {
      // The revocation is a server action; anything it throws — a refusal or an
      // unreachable server — has already lost its shape by the time it lands here.
      setError("unexpected");
    } finally {
      setPending(null);
    }
  }

  return (
    <SettingsSection
      description={t("description")}
      id="sessions-settings"
      title={t("title")}
    >
      <ul className="divide-border divide-y">
        {sessions.map((session) => {
          const label = describe(session);

          return (
            <li
              aria-label={label}
              className="flex items-center justify-between gap-4 py-3"
              key={session.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{label}</p>
                <p className="text-muted-foreground text-sm">
                  {session.isCurrent
                    ? t("current")
                    : t("lastActive", { when: session.lastActive })}
                </p>
              </div>
              {session.isCurrent ? null : (
                <Button
                  disabled={pending !== null}
                  onClick={() =>
                    void run(session.id, () => revokeSession(session.id))
                  }
                  type="button"
                  variant="outline"
                >
                  {pending === session.id ? t("revoking") : t("revoke")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <SettingsError code={error} />
      {others.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("onlyThisDevice")}</p>
      ) : (
        <Button
          disabled={pending !== null}
          onClick={() => void run("others", revokeOtherSessions)}
          type="button"
          variant="outline"
        >
          {pending === "others" ? t("revokingOthers") : t("revokeOthers")}
        </Button>
      )}
    </SettingsSection>
  );
}
