import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readMailbox } from "./adapters/dev-mailbox-sender";
import { createEmailSender } from "./create-email-sender";

function temporaryMailbox(): string {
  return mkdtempSync(path.join(tmpdir(), "ai-starter-mailbox-"));
}

describe("createEmailSender", () => {
  it("falls back to the on-disk dev mailbox when no Resend key is configured", async () => {
    const mailboxDir = temporaryMailbox();
    const sender = createEmailSender({
      from: "AI Starter <onboarding@resend.dev>",
      mailboxDir,
      resendApiKey: undefined,
    });

    await sender.send({
      html: "<p>Hi</p>",
      subject: "Welcome",
      text: "Welcome",
      to: "person@example.com",
    });

    expect(readMailbox(mailboxDir).map((m) => m.subject)).toEqual(["Welcome"]);
  });

  it("treats an empty Resend key like an absent one", async () => {
    const mailboxDir = temporaryMailbox();
    const sender = createEmailSender({
      from: "AI Starter <onboarding@resend.dev>",
      mailboxDir,
      resendApiKey: "",
    });

    await sender.send({
      html: "<p>Hi</p>",
      subject: "Welcome",
      text: "Welcome",
      to: "person@example.com",
    });

    expect(readMailbox(mailboxDir)).toHaveLength(1);
  });
});
