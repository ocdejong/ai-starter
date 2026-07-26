/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // React Native's babel preset compiles `react-native` imports into lazy
  // requires, so the first test in the process that renders a component pays
  // the require-plus-transform cost of the whole RN component graph, not just
  // its own work. On GitHub's shared runners the Jest cache is always cold and
  // that bring-up alone exceeds Jest's 5000 ms default (measured: ~1.4 s cold
  // on an M-series laptop, >5 s on CI, where the same suite runs ~5x slower).
  // 20 s budgets for the one-time bring-up while still failing a genuinely
  // hung test quickly; every test after the first settles in milliseconds.
  testTimeout: 20000,
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|ai|@ai-sdk/.*|@workflow/.*|use-intl|intl-messageformat|@formatjs/.*))",
  ],
};
