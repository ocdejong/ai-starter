import { authErrorCode, authErrorKey } from "./errors";

describe("authErrorKey", () => {
  it.each([
    ["INVALID_EMAIL_OR_PASSWORD", "invalidCredentials"],
    ["INVALID_PASSWORD", "invalidCredentials"],
    ["CREDENTIAL_ACCOUNT_NOT_FOUND", "invalidCredentials"],
    ["USER_NOT_FOUND", "invalidCredentials"],
    ["INVALID_TOKEN", "resetLinkRejected"],
    ["TOKEN_EXPIRED", "resetLinkRejected"],
  ])("translates the %s response code to %s", (code, expected) => {
    expect(authErrorKey({ code, status: 400 })).toBe(expected);
  });

  it("says nothing specific about an unverified account, which is a route change", () => {
    expect(authErrorKey({ code: "EMAIL_NOT_VERIFIED", status: 403 })).toBe(
      "unexpected",
    );
  });

  it("treats a thrown transport failure as an unreachable server", () => {
    expect(authErrorKey(new TypeError("Network request failed"))).toBe(
      "network",
    );
  });

  it("falls back to the generic message for an unmapped code", () => {
    expect(authErrorKey({ code: "SOMETHING_NEW", status: 500 })).toBe(
      "unexpected",
    );
  });

  it("falls back to the generic message when there is no error detail", () => {
    expect(authErrorKey(null)).toBe("unexpected");
  });
});

describe("authErrorCode", () => {
  it("reads the code the server answered with", () => {
    expect(authErrorCode({ code: "EMAIL_NOT_VERIFIED" })).toBe(
      "EMAIL_NOT_VERIFIED",
    );
  });

  it("has no code for a request that never completed", () => {
    expect(
      authErrorCode(new TypeError("Network request failed")),
    ).toBeUndefined();
  });
});
