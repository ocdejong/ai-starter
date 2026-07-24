import { describe, expect, it, vi } from "vitest";

import {
  createResendEmailSender,
  translateResendResult,
  type ResendLike,
} from "./resend-sender";

const message = {
  html: "<p>Hello</p>",
  subject: "Hello",
  text: "Hello",
  to: "person@example.com",
} as const;

describe("translateResendResult", () => {
  it("maps a successful send to an ok result carrying the provider id", () => {
    expect(
      translateResendResult({ data: { id: "email-1" }, error: null }),
    ).toEqual({ id: "email-1", ok: true });
  });

  it("maps a documented validation error to a failed result", () => {
    expect(
      translateResendResult({
        data: null,
        error: { message: "Invalid `to` field.", name: "validation_error" },
      }),
    ).toEqual({ error: "validation_error: Invalid `to` field.", ok: false });
  });

  it("maps a documented rate-limit error to a failed result", () => {
    expect(
      translateResendResult({
        data: null,
        error: { message: "Too many requests.", name: "rate_limit_exceeded" },
      }),
    ).toEqual({
      error: "rate_limit_exceeded: Too many requests.",
      ok: false,
    });
  });

  it("rejects a response shape the SDK is not documented to return", () => {
    expect(() => translateResendResult({ unexpected: true })).toThrow();
  });
});

describe("createResendEmailSender", () => {
  it("sends the rendered message through the client and returns the id", async () => {
    const send = vi.fn(async () => ({ data: { id: "email-9" }, error: null }));
    const client: ResendLike = { emails: { send } };
    const sender = createResendEmailSender(
      "re_test",
      "AI Starter <onboarding@resend.dev>",
      client,
    );

    const result = await sender.send(message);

    expect(send).toHaveBeenCalledWith({
      from: "AI Starter <onboarding@resend.dev>",
      html: message.html,
      subject: message.subject,
      text: message.text,
      to: message.to,
    });
    expect(result).toEqual({ id: "email-9", ok: true });
  });

  it("returns a failed result when the provider reports an error", async () => {
    const send = vi.fn(async () => ({
      data: null,
      error: {
        message: "The from address is not verified.",
        name: "invalid_from_address",
      },
    }));
    const sender = createResendEmailSender("re_test", "AI Starter <bad@from>", {
      emails: { send },
    });

    const result = await sender.send(message);

    expect(result).toEqual({
      error: "invalid_from_address: The from address is not verified.",
      ok: false,
    });
  });
});
