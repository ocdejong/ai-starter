import { describe, expect, it } from "vitest";

import { describeDevice, deviceBrowsers, devicePlatforms } from "./device";

describe("describeDevice", () => {
  it("names the browser and platform of a desktop Chrome session", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      ),
    ).toEqual({ browser: "chrome", platform: "macos" });
  });

  it("does not mistake Chrome for Safari, which every Chrome agent also names", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ browser: "chrome", platform: "ios" });
  });

  it("does not mistake Edge for Chrome, which every Edge agent also names", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      ),
    ).toEqual({ browser: "edge", platform: "windows" });
  });

  it("recognises Safari on iOS and Firefox on Linux", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ browser: "safari", platform: "ios" });
    expect(
      describeDevice(
        "Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0",
      ),
    ).toEqual({ browser: "firefox", platform: "linux" });
  });

  it("recognises the platform of a native client that names no browser", () => {
    // The Expo client is an HTTP client, not a browser: naming a browser it does
    // not have would be a guess presented as a fact.
    expect(describeDevice("okhttp/4.12.0 (Android 15; Pixel 9)")).toEqual({
      browser: "unknown",
      platform: "android",
    });
  });

  it("admits it does not know, rather than guessing, for an absent or foreign agent", () => {
    expect(describeDevice(null)).toEqual({
      browser: "unknown",
      platform: "unknown",
    });
    expect(describeDevice("")).toEqual({
      browser: "unknown",
      platform: "unknown",
    });
    expect(describeDevice("curl/8.7.1")).toEqual({
      browser: "unknown",
      platform: "unknown",
    });
  });

  it("only ever reports a label both platforms can translate", () => {
    const agents = [
      "Mozilla/5.0 (Macintosh) Chrome/141 Safari/537.36",
      "okhttp/4.12.0 (Android 15)",
      "curl/8.7.1",
      null,
    ];

    for (const agent of agents) {
      const { browser, platform } = describeDevice(agent);
      expect(deviceBrowsers).toContain(browser);
      expect(devicePlatforms).toContain(platform);
    }
  });
});
