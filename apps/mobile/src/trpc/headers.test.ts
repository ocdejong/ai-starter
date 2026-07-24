import { trpcRequestHeaders } from "./headers";

describe("trpcRequestHeaders", () => {
  it("forwards the stored session cookie, because native fetch sends none", () => {
    expect(trpcRequestHeaders("better-auth.session_token=abc")).toEqual({
      Cookie: "better-auth.session_token=abc",
      "x-trpc-source": "expo-react-native",
    });
  });

  it("omits the header entirely when no session is stored", () => {
    expect(trpcRequestHeaders("")).toEqual({
      "x-trpc-source": "expo-react-native",
    });
  });
});
