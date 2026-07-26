import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createDevEmailSender, readMailbox } from "./dev-mailbox-sender";

function temporaryMailbox(): string {
  return mkdtempSync(path.join(tmpdir(), "ai-starter-mailbox-"));
}

describe("dev mailbox sender", () => {
  it("records a sent message so it can be retrieved with its action URL", async () => {
    const dir = temporaryMailbox();
    const log = vi.fn();
    const sender = createDevEmailSender(dir, log);
    const url = "https://app.example.com/reset?token=xyz";

    const result = await sender.send({
      html: `<a href="${url}">Reset</a>`,
      subject: "Reset your password",
      text: `Reset your password: ${url}`,
      to: "person@example.com",
    });

    expect(result).toEqual({ id: null, ok: true });

    const stored = readMailbox(dir);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.to).toBe("person@example.com");
    expect(stored[0]?.subject).toBe("Reset your password");
    expect(stored[0]?.text).toContain(url);
    expect(log).toHaveBeenCalledOnce();
  });

  it("returns recorded messages in the order they were sent", async () => {
    const dir = temporaryMailbox();
    const sender = createDevEmailSender(dir, () => undefined);

    await sender.send({
      html: "1",
      subject: "One",
      text: "one",
      to: "1@x.com",
    });
    await sender.send({
      html: "2",
      subject: "Two",
      text: "two",
      to: "2@x.com",
    });

    expect(readMailbox(dir).map((m) => m.to)).toEqual(["1@x.com", "2@x.com"]);
  });

  it("returns an empty list for a mailbox with no messages", () => {
    expect(readMailbox(temporaryMailbox())).toEqual([]);
  });

  it("never shows a reader watching the mailbox a half-written message", async () => {
    const dir = temporaryMailbox();
    const sender = createDevEmailSender(dir, () => undefined);
    const messageCount = 20;

    // A Playwright journey polls `readMailbox` while the server is still
    // sending, and it parses every file before filtering by address — so one
    // message landing byte by byte breaks a read looking for another one.
    const failures: string[] = [];
    let reads = 0;
    let sending = true;
    const reader = (async () => {
      while (sending) {
        try {
          readMailbox(dir);
        } catch (error) {
          failures.push(String(error));
        }
        reads += 1;
        await new Promise((resolve) => setImmediate(resolve));
      }
    })();

    for (let index = 0; index < messageCount; index += 1) {
      await sender.send({
        html: `<p>${String(index)}</p>`,
        subject: `Message ${String(index)}`,
        text: `Message ${String(index)}`,
        to: "watcher@example.com",
      });
    }
    sending = false;
    await reader;

    // Without this the assertions below hold vacuously: a reader that never got
    // a turn between the sends has not observed anything.
    expect(reads).toBeGreaterThan(0);
    expect(failures).toEqual([]);
    expect(readMailbox(dir)).toHaveLength(messageCount);
    // Nothing partial is left behind under a name a reader would pick up.
    expect(readdirSync(dir).filter((name) => !name.endsWith(".json"))).toEqual(
      [],
    );
  });
});
