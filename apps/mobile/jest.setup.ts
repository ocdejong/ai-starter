import type appJson from "./app.json";

// The theme provider reads persisted state and controls the splash screen;
// both are native modules, so every test runs against in-memory fakes.
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual<object>(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);

jest.mock("expo-splash-screen", () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));

// jest-expo leaves `Constants.expoConfig` null, so anything reading the app's own
// configuration — the deep-link scheme, for one — would see nothing. Serving the
// real app.json keeps the tests honest about what the native build registers.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: jest.requireActual<typeof appJson>("./app.json").expo,
  },
}));

// The Expo auth client persists the session cookie in the device keychain. An
// in-memory store keeps that seam real (values written are read back) without a
// native module.
jest.mock("expo-secure-store", () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
});
