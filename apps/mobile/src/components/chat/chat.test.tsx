import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";

import { chatNotConfiguredCode } from "../../chat/error";
import { TestProviders } from "../../test/providers";
import { Chat } from "./chat";

// The real transport reaches for `expo/fetch` and the keychain-backed session
// cookie, neither of which exists under jest. Standing in for it at the module
// boundary keeps the rest real: this suite runs the actual `useChat`, so the
// transcript, the optimistic append and the error mapping are the shipped ones.
const mockSendMessages = jest.fn<Promise<unknown>, [unknown]>();

jest.mock("../../chat/transport", () => ({
  chatTransport: {
    reconnectToStream: () => Promise.resolve(null),
    sendMessages: (options: unknown) => mockSendMessages(options),
  },
}));

const emptyState = "Send a message to start the conversation.";
const placeholder = "Type a message…";

/** A request that never settles: enough to observe the optimistic transcript. */
function pending(): Promise<never> {
  return new Promise<never>(() => {
    // Intentionally never resolves.
  });
}

async function renderChat(locale: "en" | "nl" = "en") {
  return render(
    <TestProviders locale={locale}>
      <Chat />
    </TestProviders>,
  );
}

describe("Chat", () => {
  beforeEach(() => {
    mockSendMessages.mockReset();
    mockSendMessages.mockImplementation(pending);
  });

  it("invites the first message when the conversation is empty", async () => {
    await renderChat();

    expect(screen.getByText(emptyState)).toBeTruthy();
    expect(screen.getByPlaceholderText(placeholder)).toBeTruthy();
  });

  it("renders each text part of a message with its author", async () => {
    await render(
      <TestProviders>
        <Chat
          initialMessages={[
            {
              id: "m1",
              parts: [{ text: "Hello", type: "text" }],
              role: "user",
            },
            {
              id: "m2",
              parts: [
                { text: "Hi there.", type: "text" },
                { text: "How can I help?", type: "text" },
              ],
              role: "assistant",
            },
          ]}
        />
      </TestProviders>,
    );

    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByText("Hi there.")).toBeTruthy();
    expect(screen.getByText("How can I help?")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Assistant")).toBeTruthy();
  });

  it("keeps an empty composer out of the transcript", async () => {
    const user = userEvent.setup();
    await renderChat();

    await user.press(screen.getByText("Send"));

    expect(mockSendMessages).not.toHaveBeenCalled();
    expect(screen.getByText(emptyState)).toBeTruthy();
  });

  it("puts what was typed in the transcript and clears the composer", async () => {
    const user = userEvent.setup();
    await renderChat();

    await user.type(screen.getByPlaceholderText(placeholder), "Are you there?");
    await user.press(screen.getByText("Send"));

    expect(mockSendMessages).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Are you there?")).toBeTruthy();
    expect(screen.queryByText(emptyState)).toBeNull();
    expect(screen.getByPlaceholderText(placeholder).props.value).toBe("");
  });

  it("offers to stop a reply that is still arriving", async () => {
    const user = userEvent.setup();
    await renderChat();

    await user.type(screen.getByPlaceholderText(placeholder), "Hello");
    await user.press(screen.getByText("Send"));

    expect(screen.getByText("Stop")).toBeTruthy();
  });

  it("states honestly that the deployment has no provider key", async () => {
    mockSendMessages.mockRejectedValue(
      new Error(`{"error":"${chatNotConfiguredCode}"}`),
    );
    const user = userEvent.setup();
    await renderChat();

    await user.type(screen.getByPlaceholderText(placeholder), "Hello");
    await user.press(screen.getByText("Send"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Chat is not configured. Set ANTHROPIC_API_KEY to enable it.",
        ),
      ).toBeTruthy();
    });
    expect(screen.getByPlaceholderText(placeholder).props.editable).toBe(false);
  });

  it("reports any other failure without blaming the configuration", async () => {
    mockSendMessages.mockRejectedValue(new Error("Network request failed"));
    const user = userEvent.setup();
    await renderChat();

    await user.type(screen.getByPlaceholderText(placeholder), "Hello");
    await user.press(screen.getByText("Send"));

    await waitFor(() => {
      expect(
        screen.getByText("The assistant could not answer. Try again."),
      ).toBeTruthy();
    });
    expect(screen.getByPlaceholderText(placeholder).props.editable).toBe(true);
  });

  it("renders in Dutch under the Dutch catalog", async () => {
    await renderChat("nl");

    expect(screen.getByPlaceholderText("Typ een bericht…")).toBeTruthy();
  });
});
