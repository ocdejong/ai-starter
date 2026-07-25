import { chatErrorCode, chatNotConfiguredCode } from "./error";

describe("chatErrorCode", () => {
  it("reads the code the server refused with", () => {
    expect(
      chatErrorCode(new Error(`{"error":"${chatNotConfiguredCode}"}`)),
    ).toBe(chatNotConfiguredCode);
  });

  it("has no code for a transport failure", () => {
    expect(chatErrorCode(new Error("Network request failed"))).toBeUndefined();
  });

  it("has no code for a JSON body that is not a refusal", () => {
    expect(chatErrorCode(new Error('{"detail":"nope"}'))).toBeUndefined();
    expect(chatErrorCode(new Error("[]"))).toBeUndefined();
  });

  it("has no code when nothing failed", () => {
    expect(chatErrorCode(undefined)).toBeUndefined();
  });
});
