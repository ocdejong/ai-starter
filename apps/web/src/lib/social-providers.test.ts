import { describe, expect, it } from "vitest";

import {
  oauthCredentials,
  resolvePrimarySocialProvider,
} from "./social-providers";

describe("oauthCredentials", () => {
  it("pairs an id with its secret", () => {
    expect(oauthCredentials("id", "secret")).toStrictEqual({
      clientId: "id",
      clientSecret: "secret",
    });
  });

  it.each([
    ["no id", undefined, "secret"],
    ["no secret", "id", undefined],
    ["an empty id", "", "secret"],
    ["an empty secret", "id", ""],
  ])("configures nothing with %s", (_case, clientId, clientSecret) => {
    expect(oauthCredentials(clientId, clientSecret)).toBeUndefined();
  });
});

describe("resolvePrimarySocialProvider", () => {
  const credentials = { clientId: "id", clientSecret: "secret" };

  it("offers nothing when neither provider is configured", () => {
    expect(resolvePrimarySocialProvider({})).toBeNull();
  });

  it("offers Google when only Google is configured", () => {
    expect(resolvePrimarySocialProvider({ google: credentials })).toBe(
      "google",
    );
  });

  it("offers GitHub when only GitHub is configured", () => {
    expect(resolvePrimarySocialProvider({ github: credentials })).toBe(
      "github",
    );
  });

  it("prefers Google when both are configured", () => {
    expect(
      resolvePrimarySocialProvider({
        github: credentials,
        google: credentials,
      }),
    ).toBe("google");
  });
});
