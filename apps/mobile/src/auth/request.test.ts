import { signUpInputSchema } from "@ai-starter/domain";

import { authRequestOutcome, fieldValidationCodes } from "./request";

describe("authRequestOutcome", () => {
  it("reports success as no failure", async () => {
    await expect(
      authRequestOutcome(() => Promise.resolve({ error: null })),
    ).resolves.toBeNull();
  });

  it("carries both the message key and the raw code", async () => {
    await expect(
      authRequestOutcome(() =>
        Promise.resolve({ error: { code: "EMAIL_NOT_VERIFIED", status: 403 } }),
      ),
    ).resolves.toEqual({ code: "EMAIL_NOT_VERIFIED", key: "unexpected" });
  });

  it("classifies a request that never completed", async () => {
    await expect(
      authRequestOutcome(() =>
        Promise.reject(new TypeError("Network request failed")),
      ),
    ).resolves.toEqual({ code: undefined, key: "network" });
  });
});

describe("fieldValidationCodes", () => {
  it("reads the code each domain schema issue reports", () => {
    const result = signUpInputSchema.safeParse({
      email: "nope",
      name: "",
      password: "short",
    });

    expect(
      Object.fromEntries(fieldValidationCodes(result.error?.issues ?? [])),
    ).toEqual({
      email: "emailInvalid",
      name: "nameRequired",
      password: "passwordTooShort",
    });
  });

  it("keeps an unrecognised message as an unexplained failure", () => {
    expect(
      fieldValidationCodes([{ message: "not a code", path: ["email"] }]).get(
        "email",
      ),
    ).toBeNull();
  });

  it("ignores an issue that names no field", () => {
    expect(
      fieldValidationCodes([
        { message: "emailInvalid", path: [] },
        { message: "emailInvalid", path: [0] },
      ]).size,
    ).toBe(0);
  });
});
