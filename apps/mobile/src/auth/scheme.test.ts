import { resolveScheme } from "./scheme";

describe("resolveScheme", () => {
  it("uses the single scheme the Expo config declares", () => {
    expect(resolveScheme("ai-starter")).toBe("ai-starter");
  });

  it("uses the first entry when the config declares several", () => {
    expect(resolveScheme(["ai-starter", "com.example.aistarter"])).toBe(
      "ai-starter",
    );
  });

  it.each([undefined, "", "   ", [], [""], 7])(
    "refuses to guess a scheme from %p",
    (configured) => {
      expect(() => resolveScheme(configured)).toThrow(/scheme/);
    },
  );
});
