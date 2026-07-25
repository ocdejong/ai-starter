/**
 * The device labels a session list may show, as stable codes rather than prose.
 * Like the validation codes, these are platform-neutral and cannot reach a
 * message catalog: each is a key the web and native settings screens translate.
 */
export const deviceBrowsers = [
  "chrome",
  "edge",
  "firefox",
  "safari",
  "unknown",
] as const;

export const devicePlatforms = [
  "android",
  "ios",
  "linux",
  "macos",
  "windows",
  "unknown",
] as const;

export type DeviceBrowser = (typeof deviceBrowsers)[number];
export type DevicePlatform = (typeof devicePlatforms)[number];

export type DeviceDescription = {
  readonly browser: DeviceBrowser;
  readonly platform: DevicePlatform;
};

/**
 * Order matters: a user agent names every engine it claims compatibility with,
 * so the most specific claim has to win. Every Edge agent also says "Chrome",
 * and every Chrome agent also says "Safari" — matching in the other order would
 * label most of the world's browsers Safari.
 */
const browserMarkers: readonly (readonly [DeviceBrowser, RegExp])[] = [
  ["edge", /\bEdgi?[A-Za-z]*\//],
  ["chrome", /\b(?:Chrome|CriOS|Chromium)\//],
  ["firefox", /\b(?:Firefox|FxiOS)\//],
  ["safari", /\bVersion\/[\d.]+ (?:Mobile\/\S+ )?Safari\//],
];

const platformMarkers: readonly (readonly [DevicePlatform, RegExp])[] = [
  ["android", /\bAndroid\b/],
  ["ios", /\b(?:iPhone|iPad|iPod)\b/],
  ["windows", /\bWindows\b/],
  ["macos", /\b(?:Macintosh|Mac OS X)\b/],
  ["linux", /\b(?:Linux|X11)\b/],
];

/**
 * Best-effort reading of the user agent a session was created with, so a person
 * can recognise their own devices in a list.
 *
 * It is a hint, never an identification: a user agent is client-supplied and
 * freely spoofed, and nothing here may be used to make a decision. Anything
 * unrecognised — a native HTTP client, a scripted request, a browser released
 * after this table — reports `unknown` instead of guessing, because a wrong
 * device name is worse than an absent one when the question being asked is "do
 * I recognise this session?".
 */
export function describeDevice(userAgent: string | null): DeviceDescription {
  if (userAgent === null || userAgent === "") {
    return { browser: "unknown", platform: "unknown" };
  }

  return {
    browser: match(browserMarkers, userAgent),
    platform: match(platformMarkers, userAgent),
  };
}

function match<T extends DeviceBrowser | DevicePlatform>(
  markers: readonly (readonly [T, RegExp])[],
  userAgent: string,
): T | "unknown" {
  return (
    markers.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? "unknown"
  );
}
