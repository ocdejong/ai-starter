import {
  describeDevice,
  type DeviceBrowser,
  type DevicePlatform,
} from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { useTheme } from "../../theme/theme-provider";
import { Notice } from "../auth/notice";
import { SettingsBlock } from "./settings-block";
import { settingsOutcome, type SettingsErrorKey } from "./settings-failure";

/** The listing, reduced to what a row needs and ordered with this device first. */
function project(
  rows: readonly {
    readonly token: string;
    readonly updatedAt: Date | string;
    readonly userAgent?: string | null | undefined;
  }[],
  currentToken: string,
): readonly SessionRow[] {
  return rows
    .map((row) => ({
      ...describeDevice(row.userAgent ?? null),
      isCurrent: row.token === currentToken,
      token: row.token,
      updatedAt: new Date(row.updatedAt),
    }))
    .sort(
      (first, second) => Number(second.isCurrent) - Number(first.isCurrent),
    );
}

type SessionRow = {
  readonly browser: DeviceBrowser;
  readonly isCurrent: boolean;
  readonly platform: DevicePlatform;
  readonly token: string;
  readonly updatedAt: Date;
};

/**
 * Where the account is signed in, and the way to end any of it.
 *
 * Unlike the web page, this list is read in the client: Better Auth revokes by
 * session token, and on a phone there is no injected-script problem that keeping
 * tokens on the server would solve — the app already holds its own token in the
 * keychain. The token never leaves this component.
 */
export function SessionsList({ currentToken }: { currentToken: string }) {
  const t = useTranslations("app.settings.sessions");
  const tErrors = useTranslations("app.settings.errors");
  const format = useFormatter();
  const { theme } = useTheme();
  const [rows, setRows] = useState<readonly SessionRow[] | null>(null);
  const [errorKey, setErrorKey] = useState<SettingsErrorKey | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // Bumped after a revocation: the server decides which sessions survived, so
  // the list is re-read rather than edited in place.
  const [reads, setReads] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadSessions() {
      try {
        const { data, error } = await authClient.listSessions();
        if (!active) {
          return;
        }
        if (error !== null && error !== undefined) {
          setErrorKey("unexpected");
          return;
        }
        setErrorKey(null);
        setRows(project(data ?? [], currentToken));
      } catch {
        if (active) {
          setErrorKey("network");
        }
      }
    }

    void loadSessions();
    return () => {
      active = false;
    };
  }, [currentToken, reads]);

  function describe({ browser, platform }: SessionRow): string {
    return browser === "unknown" && platform === "unknown"
      ? t("unknownDevice")
      : t("device", {
          browser: t(`browser.${browser}`),
          platform: t(`platform.${platform}`),
        });
  }

  async function revoke(
    key: string,
    call: () => Promise<{ readonly error?: unknown }>,
  ) {
    setPending(key);
    const failure = await settingsOutcome(call);
    setPending(null);

    if (failure !== null) {
      setErrorKey(failure);
      return;
    }
    setReads((count) => count + 1);
  }

  const others = (rows ?? []).filter((row) => !row.isCurrent);

  return (
    <SettingsBlock description={t("description")} title={t("title")}>
      {(rows ?? []).map((row) => {
        const label = describe(row);

        return (
          <View accessibilityLabel={label} key={row.token} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.device, { color: theme.foreground }]}>
                {label}
              </Text>
              <Text style={[styles.when, { color: theme["muted-foreground"] }]}>
                {row.isCurrent
                  ? t("current")
                  : t("lastActive", {
                      when: format.dateTime(row.updatedAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    })}
              </Text>
            </View>
            {row.isCurrent ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: pending !== null }}
                disabled={pending !== null}
                onPress={() =>
                  void revoke(row.token, () =>
                    authClient.revokeSession({ token: row.token }),
                  )
                }
                style={[styles.action, { borderColor: theme.border }]}
              >
                <Text style={[styles.actionLabel, { color: theme.foreground }]}>
                  {pending === row.token ? t("revoking") : t("revoke")}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {errorKey === null ? null : (
        <Notice message={tErrors(errorKey)} tone="error" />
      )}
      {rows === null ? null : others.length === 0 ? (
        <Text style={[styles.when, { color: theme["muted-foreground"] }]}>
          {t("onlyThisDevice")}
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pending !== null }}
          disabled={pending !== null}
          onPress={() =>
            void revoke("others", () => authClient.revokeOtherSessions())
          }
          style={[styles.action, { borderColor: theme.border }]}
        >
          <Text style={[styles.actionLabel, { color: theme.foreground }]}>
            {pending === "others" ? t("revokingOthers") : t("revokeOthers")}
          </Text>
        </Pressable>
      )}
    </SettingsBlock>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  device: {
    fontSize: 15,
    fontWeight: "600",
  },
  when: {
    fontSize: 13,
  },
  action: {
    alignItems: "center",
    borderRadius: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});
