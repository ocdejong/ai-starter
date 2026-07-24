import { resolveAuthRedirect } from "./redirect";

describe("resolveAuthRedirect", () => {
  it("waits while the stored session is still being read", () => {
    expect(
      resolveAuthRedirect({
        pending: true,
        segments: ["index"],
        signedIn: false,
      }),
    ).toBeNull();
  });

  it("sends a signed-out visitor on a protected screen to sign-in", () => {
    expect(
      resolveAuthRedirect({
        pending: false,
        segments: ["index"],
        signedIn: false,
      }),
    ).toBe("/sign-in");
  });

  it("leaves a signed-out visitor inside the auth group alone", () => {
    expect(
      resolveAuthRedirect({
        pending: false,
        segments: ["(auth)", "sign-up"],
        signedIn: false,
      }),
    ).toBeNull();
  });

  it("sends a signed-in user off a credential screen", () => {
    expect(
      resolveAuthRedirect({
        pending: false,
        segments: ["(auth)", "sign-in"],
        signedIn: true,
      }),
    ).toBe("/");
  });

  it.each(["reset-password", "verify-email"])(
    "keeps a signed-in user on the deep-linked %s screen",
    (screen) => {
      expect(
        resolveAuthRedirect({
          pending: false,
          segments: ["(auth)", screen],
          signedIn: true,
        }),
      ).toBeNull();
    },
  );

  it("leaves a signed-in user on a protected screen alone", () => {
    expect(
      resolveAuthRedirect({
        pending: false,
        segments: ["index"],
        signedIn: true,
      }),
    ).toBeNull();
  });
});
