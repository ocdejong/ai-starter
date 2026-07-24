/**
 * Headers every tRPC request carries.
 *
 * React Native's fetch has no cookie jar, so the session cookie the Expo auth
 * client keeps in SecureStore has to be attached by hand — the request is sent
 * with `credentials: "omit"` precisely so nothing else is inferred. An empty
 * cookie means "signed out"; sending `Cookie: ""` would be a malformed header,
 * so the field is left out instead.
 */
export function trpcRequestHeaders(cookie: string): Record<string, string> {
  return {
    ...(cookie === "" ? {} : { Cookie: cookie }),
    "x-trpc-source": "expo-react-native",
  };
}
