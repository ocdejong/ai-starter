// Patch Intl (Hermes has no Intl.PluralRules) before anything formats a message.
import "../i18n/polyfills";

import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SessionGate } from "../auth/session-gate";
import { mobileEnv } from "../env";
import { LocaleProvider } from "../i18n/locale-provider";
import { ThemeProvider, useTheme } from "../theme/theme-provider";
import { TRPCProvider } from "../trpc/provider";

Sentry.init({
  dsn: mobileEnv.EXPO_PUBLIC_SENTRY_DSN ?? "",
  enabled:
    Boolean(mobileEnv.EXPO_PUBLIC_SENTRY_DSN) &&
    process.env.NODE_ENV !== "test",
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
});

/** Applies the resolved scheme to the navigator background and status bar. */
function ThemedNavigation() {
  const { scheme, theme } = useTheme();

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.background },
          headerShown: false,
        }}
      />
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </>
  );
}

function RootLayout() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <TRPCProvider>
          <SessionGate>
            <ThemedNavigation />
          </SessionGate>
        </TRPCProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);
