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
  it("refuses to write to the dev mailbox when it is not allowed", async () => {
    // The dev mailbox writes every message to disk and logs its text, which
    // carries the verification and password-reset URLs — bearer tokens. A
    // deployment that lost its RESEND_API_KEY must not quietly degrade to that.
    const mailboxDir = temporaryMailbox();
    const sender = createEmailSender({
      allowDevMailbox: false,
      from: "AI Starter <onboarding@resend.dev>",
      mailboxDir,
      resendApiKey: undefined,
    });

    const result = await sender.send({
      html: "<p>Hi</p>",
      subject: "Welcome",
      text: "Welcome https://app.example.com/verify?token=secret",
      to: "person@example.com",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("RESEND_API_KEY");
    // Nothing reached the disk, so no token did either.
    expect(readMailbox(mailboxDir)).toHaveLength(0);
  });

  it("still constructs without a key, so a keyless production build succeeds", () => {
    // The web composition root builds the sender at module scope and `next
    // build` runs with NODE_ENV=production. Throwing here would fail the build
    // of every keyless clone, including the template rehearsal.
    expect(() =>
      createEmailSender({
        allowDevMailbox: false,
        from: "AI Starter <onboarding@resend.dev>",
        mailboxDir: temporaryMailbox(),
        resendApiKey: undefined,
      }),
    ).not.toThrow();
  });

  it("falls back to the on-disk dev mailbox when no Resend key is configured", async () => {
    const mailboxDir = temporaryMailbox();
    const sender = createEmailSender({
      allowDevMailbox: true,
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
      allowDevMailbox: true,
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
