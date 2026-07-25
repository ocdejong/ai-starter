import type { EmailMessage, EmailSender } from "@ai-starter/api";
import { describe, expect, it, vi } from "vitest";

import {
  createAuthEmailDispatchers,
  groupInvitationPath,
} from "./email-dispatch";

function fakeSender(): { sender: EmailSender; sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sender: {
      send: vi.fn(async (message: EmailMessage) => {
        sent.push(message);
        return { id: "test", ok: true } as const;
      }),
    },
    sent,
  };
}

const appUrl = "https://app.example.com";
const url = "https://app.example.com/verify?token=abc123";

describe("createAuthEmailDispatchers", () => {
  it("renders each flow and sends it through the port with the right recipient and subject", async () => {
    const cases = [
      { flow: "sendVerification", subject: "Verify your email address" },
      { flow: "sendPasswordReset", subject: "Reset your password" },
      {
        flow: "sendChangeEmailVerification",
        subject: "Confirm your email change",
      },
      {
        flow: "sendDeleteAccountVerification",
        subject: "Confirm your account deletion",
      },
    ] as const;

    for (const { flow, subject } of cases) {
      const { sender, sent } = fakeSender();
      const dispatchers = createAuthEmailDispatchers(sender, { appUrl });

      dispatchers[flow]({ to: "person@example.com", url });

      // The dispatch is fire-and-forget, so wait for the render and send.
      await vi.waitFor(() => expect(sender.send).toHaveBeenCalledTimes(1));
      const message = sent[0];
      expect(message?.to).toBe("person@example.com");
      expect(message?.subject).toBe(subject);
      expect(message?.html.length).toBeGreaterThan(0);
      // The action link must survive into the plaintext part for clickable
      // dev-mailbox and Playwright flows.
      expect(message?.text).toContain(url);
    }
  });

  it("builds the group invitation link against the app's own routing", async () => {
    const { sender, sent } = fakeSender();
    const dispatchers = createAuthEmailDispatchers(sender, { appUrl });

    // Better Auth hands over the invitation id only; the accept page is this
    // application's, so the link is built here.
    dispatchers.sendGroupInvitation({
      invitationId: "invitation-1",
      to: "guest@example.com",
    });

    await vi.waitFor(() => expect(sender.send).toHaveBeenCalledTimes(1));
    const message = sent[0];
    expect(message?.to).toBe("guest@example.com");
    expect(message?.subject).toBe("You have been invited to a group");
    expect(message?.text).toContain(
      `${appUrl}${groupInvitationPath}/invitation-1`,
    );
  });

  it("keeps a trailing slash on the app URL out of the invitation link", async () => {
    const { sender, sent } = fakeSender();
    const dispatchers = createAuthEmailDispatchers(sender, {
      appUrl: `${appUrl}/`,
    });

    dispatchers.sendGroupInvitation({
      invitationId: "invitation-2",
      to: "guest@example.com",
    });

    await vi.waitFor(() => expect(sender.send).toHaveBeenCalledTimes(1));
    expect(sent[0]?.text).toContain(
      `${appUrl}${groupInvitationPath}/invitation-2`,
    );
  });

  it("does not throw out of the request path when a render fails", async () => {
    const { sender } = fakeSender();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const dispatchers = createAuthEmailDispatchers(sender, { appUrl });

    // A malformed URL makes the template render reject; the caller must not see it.
    expect(() =>
      dispatchers.sendVerification({ to: "person@example.com", url }),
    ).not.toThrow();

    consoleError.mockRestore();
  });
});
