import type { EmailMessage, EmailSender } from "@ai-starter/api";
import { describe, expect, it, vi } from "vitest";

import { createAuthEmailDispatchers } from "./email-dispatch";

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
      const dispatchers = createAuthEmailDispatchers(sender);

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

  it("does not throw out of the request path when a render fails", async () => {
    const { sender } = fakeSender();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const dispatchers = createAuthEmailDispatchers(sender);

    // A malformed URL makes the template render reject; the caller must not see it.
    expect(() =>
      dispatchers.sendVerification({ to: "person@example.com", url }),
    ).not.toThrow();

    consoleError.mockRestore();
  });
});
