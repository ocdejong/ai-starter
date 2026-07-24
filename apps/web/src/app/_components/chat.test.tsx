import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { Chat } from "./chat";

function renderChat(
  props: Partial<React.ComponentProps<typeof Chat>> = {},
  locale: "en" | "nl" = "en",
) {
  return render(
    <IntlTestProvider locale={locale}>
      <Chat isConfigured isSignedIn {...props} />
    </IntlTestProvider>,
  );
}

describe("Chat", () => {
  it("offers a composer to a signed-in visitor", () => {
    renderChat();

    expect(screen.getByPlaceholderText("Type a message…")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("prompts a signed-out visitor to sign in and disables the composer", () => {
    renderChat({ isSignedIn: false });

    expect(screen.getByPlaceholderText("Type a message…")).toBeDisabled();
    expect(
      screen.getByText("Sign in to chat with the assistant."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("states honestly that chat is unconfigured when no provider key is set", () => {
    renderChat({ isConfigured: false });

    expect(
      screen.getByText(
        "Chat is not configured. Set ANTHROPIC_API_KEY to enable it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a message…")).toBeDisabled();
  });

  it("does not offer a sign-in link when chat is unconfigured", () => {
    renderChat({ isConfigured: false, isSignedIn: false });

    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("renders each text part of a message with its author", () => {
    renderChat({
      initialMessages: [
        { id: "m1", parts: [{ text: "Hello", type: "text" }], role: "user" },
        {
          id: "m2",
          parts: [
            { text: "Hi there.", type: "text" },
            { text: "How can I help?", type: "text" },
          ],
          role: "assistant",
        },
      ],
    });

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there.")).toBeInTheDocument();
    expect(screen.getByText("How can I help?")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });

  it("ignores non-text parts such as step markers", () => {
    renderChat({
      initialMessages: [
        {
          id: "m1",
          parts: [{ type: "step-start" }, { text: "Answer", type: "text" }],
          role: "assistant",
        },
      ],
    });

    expect(screen.getByText("Answer")).toBeInTheDocument();
  });

  it("invites the first message when the conversation is empty", () => {
    renderChat();

    expect(
      screen.getByText("Send a message to start the conversation."),
    ).toBeInTheDocument();
  });

  it("renders in Dutch under the Dutch catalog", () => {
    renderChat({ isSignedIn: false }, "nl");

    expect(
      screen.getByText("Log in om met de assistent te chatten."),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Typ een bericht…")).toBeDisabled();
  });
});
