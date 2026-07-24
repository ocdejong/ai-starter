import { verifyEmailState } from "./verify-email";

describe("verifyEmailState", () => {
  it("waits for the link after sign-up sent one", () => {
    expect(verifyEmailState({ sent: "1" })).toBe("pending");
  });

  it("treats a parameterless arrival as the server's successful redirect", () => {
    expect(verifyEmailState({})).toBe("confirmed");
  });

  it("reports the failure the server redirected with", () => {
    expect(verifyEmailState({ error: "TOKEN_EXPIRED", sent: "1" })).toBe(
      "failed",
    );
  });
});
