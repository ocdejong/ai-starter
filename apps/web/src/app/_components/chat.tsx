"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

/**
 * The chat endpoint is a plain route handler, not a tRPC procedure, because
 * `useChat` speaks the UI message stream protocol. Built once at module scope:
 * the endpoint never varies, so a per-render transport would be pure churn.
 */
const transport = new DefaultChatTransport({ api: "/api/chat" });

export type ChatProps = {
  /** False when the deployment has no provider key; the UI then says so. */
  readonly isConfigured: boolean;
  readonly isSignedIn: boolean;
  /** Seeds the transcript. Used by tests; the real chat starts empty. */
  readonly initialMessages?: UIMessage[];
};

export function Chat({ isConfigured, initialMessages, isSignedIn }: ChatProps) {
  const t = useTranslations("chat");
  const [input, setInput] = useState("");
  const { error, messages, sendMessage, status, stop } = useChat({
    ...(initialMessages === undefined ? {} : { messages: initialMessages }),
    transport,
  });

  const canChat = isConfigured && isSignedIn;
  const isBusy = status === "submitted" || status === "streaming";

  return (
    <section className="border-border bg-card text-card-foreground flex w-full max-w-xl flex-col gap-4 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">{t("title")}</h2>

      {!isConfigured && (
        <p className="text-muted-foreground text-sm">{t("notConfigured")}</p>
      )}

      {isConfigured && !isSignedIn && (
        <p className="text-muted-foreground text-sm">
          {t("signInPrompt")}{" "}
          <Link className="text-primary underline" href="/sign-in">
            {t("signIn")}
          </Link>
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {messages.length === 0 && (
          <li className="text-muted-foreground text-sm">{t("empty")}</li>
        )}
        {messages.map((message) => (
          <li className="flex flex-col gap-1" key={message.id}>
            <span className="text-muted-foreground text-xs font-medium uppercase">
              {message.role === "user" ? t("you") : t("assistant")}
            </span>
            {message.parts.map((part, index) =>
              part.type === "text" ? (
                <p
                  className="text-sm whitespace-pre-wrap"
                  key={`${message.id}-${index}`}
                >
                  {part.text}
                </p>
              ) : null,
            )}
          </li>
        ))}
      </ol>

      {error !== undefined && (
        <p className="text-destructive text-sm" role="alert">
          {t("error")}
        </p>
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = input.trim();
          if (!canChat || text === "" || isBusy) {
            return;
          }
          setInput("");
          void sendMessage({ text });
        }}
      >
        <input
          aria-label={t("placeholder")}
          className="bg-input text-foreground border-border flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          disabled={!canChat}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("placeholder")}
          value={input}
        />
        {isBusy ? (
          <button
            className="bg-secondary text-secondary-foreground rounded-md px-4 py-2 text-sm font-medium"
            onClick={() => void stop()}
            type="button"
          >
            {t("stop")}
          </button>
        ) : (
          <button
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={!canChat}
            type="submit"
          >
            {t("send")}
          </button>
        )}
      </form>
    </section>
  );
}
