import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { mobileEnv } from "../env";
import { TRPCProvider } from "../trpc/provider";

Sentry.init({
  dsn: mobileEnv.EXPO_PUBLIC_SENTRY_DSN ?? "",
  enabled:
    Boolean(mobileEnv.EXPO_PUBLIC_SENTRY_DSN) &&
    process.env.NODE_ENV !== "test",
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
});

function RootLayout() {
  return (
    <TRPCProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </TRPCProvider>
  );
}

export default Sentry.wrap(RootLayout);
