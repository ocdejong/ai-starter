import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { TRPCProvider } from "../trpc/provider";

export default function RootLayout() {
  return (
    <TRPCProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </TRPCProvider>
  );
}
