import { expoClient } from "@better-auth/expo/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { mobileEnv } from "../env";
import { appScheme } from "./scheme";

const expoStorage = expoClient({
  scheme: appScheme,
  storage: SecureStore,
  // Deriving the prefix from the scheme keeps one app's keychain entries out of
  // another's without introducing a second identifier to rename downstream.
  storagePrefix: appScheme,
});

/**
 * The plugin re-stated against the contract Better Auth publishes.
 *
 * `expoClient()`'s own return type is not assignable to `BetterAuthClientPlugin`
 * — its `getActions` signature is emitted with the `BetterFetch` generics
 * expanded, which TypeScript will not relate to the deferred form the interface
 * declares (reproduced on TypeScript 5.9 and 6.0, and on 1.6.24 and 1.6.25 of
 * the plugin). Calling through is accepted where assigning the whole signature
 * is not, so forwarding the two arguments satisfies the interface with no cast,
 * and `satisfies` keeps `getCookie` visible on the client below.
 */
const expoAuthPlugin = {
  ...expoStorage,
  getActions: ($fetch, $store) => expoStorage.getActions($fetch, $store),
} satisfies BetterAuthClientPlugin;

/**
 * The app's single Better Auth client.
 *
 * The server factory lives in `@ai-starter/auth`, which reaches the database and
 * is therefore server-only; native talks to the same deployment over HTTP
 * instead. The Expo plugin supplies what a browser would otherwise provide: it
 * keeps the session cookie in the device keychain, replays it on each request,
 * caches the last session so a cold start renders signed-in immediately, and
 * expands a relative `callbackURL` into a deep link back into this app.
 *
 * `SecureStore`, not AsyncStorage, holds the cookie because it is a bearer
 * credential; its `getItem`/`setItem` are synchronous, which is exactly the
 * contract the plugin's storage option asks for.
 *
 * The `organization` plugin adds the group endpoints, the stores behind the
 * switcher and the members list, and `checkRolePermission` — the same access
 * control the server enforces with, so an affordance and the request behind it
 * cannot drift. It needs no call-through wrapper; only the Expo plugin's own
 * emitted signature has that problem.
 */
export const authClient = createAuthClient({
  baseURL: mobileEnv.EXPO_PUBLIC_API_URL,
  plugins: [expoAuthPlugin, organizationClient()],
});
