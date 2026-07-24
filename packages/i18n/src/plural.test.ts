import { createTranslator } from "use-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./index";

/**
 * The reference ICU-plural message. It proves the plural pipeline and the `nl`
 * locale data resolve, and it is the pattern downstream stages copy for counted
 * strings ("3 sessions", "1 invitation"). On Hermes this path needs the FormatJS
 * `Intl.PluralRules` polyfill the mobile root layout imports first; Node already
 * ships `Intl.PluralRules`, so this test guards the message, not the polyfill.
 */
describe("plural formatting", () => {
  it("selects the English plural category by count", () => {
    const t = createTranslator({ locale: "en", messages: messages.en });
    expect(t("plural.posts", { count: 0 })).toBe("You have no posts yet");
    expect(t("plural.posts", { count: 1 })).toBe("You have 1 post");
    expect(t("plural.posts", { count: 5 })).toBe("You have 5 posts");
  });

  it("selects the Dutch plural category by count", () => {
    const t = createTranslator({ locale: "nl", messages: messages.nl });
    expect(t("plural.posts", { count: 0 })).toBe("Je hebt nog geen posts");
    expect(t("plural.posts", { count: 1 })).toBe("Je hebt 1 post");
    expect(t("plural.posts", { count: 5 })).toBe("Je hebt 5 posts");
  });
});
