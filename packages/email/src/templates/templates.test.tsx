import { describe, expect, it } from "vitest";

import {
  renderChangeEmailEmail,
  renderDeleteAccountEmail,
  renderGroupInvitationEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
} from "./index";

const url = "https://app.example.com/action?token=abc123";

describe("transactional email templates", () => {
  it.each([
    ["verification", renderVerificationEmail],
    ["password reset", renderPasswordResetEmail],
    ["change email", renderChangeEmailEmail],
    ["delete account", renderDeleteAccountEmail],
    ["group invitation", renderGroupInvitationEmail],
  ])(
    "renders the %s action URL into both html and text",
    async (_name, renderTemplate) => {
      const { html, text } = await renderTemplate({ url });

      expect(html).toContain(url);
      expect(text).toContain(url);
    },
  );
});
