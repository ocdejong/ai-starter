import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { VerifyEmailNotice } from "./verify-email-notice";
import { type VerifyEmailState } from "../../auth/verify-email";

jest.mock("../../auth/client", () => ({
  authClient: { sendVerificationEmail: jest.fn() },
}));

const sendVerificationEmail = jest.mocked(authClient.sendVerificationEmail);

async function renderNotice(state: VerifyEmailState, email?: string) {
  const onSignIn = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestProviders>
      <VerifyEmailNotice
        email={email ?? undefined}
        onSignIn={onSignIn}
        state={state}
      />
    </TestProviders>,
  );

  return { onSignIn, user };
}

describe("VerifyEmailNotice", () => {
  beforeEach(() => {
    sendVerificationEmail.mockReset();
  });

  it("tells the reader where the link went while waiting", async () => {
    await renderNotice("pending", "person@example.com");

    expect(
      screen.getByText(
        "We sent a confirmation link to person@example.com. Open it to finish creating your account. Open the link on this device to continue in the app.",
      ),
    ).toBeOnTheScreen();
  });

  it("confirms the address and points at sign-in once the link was followed", async () => {
    await renderNotice("confirmed", "person@example.com");

    expect(
      screen.getByText("Your email address is confirmed. Sign in to continue."),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: "Send a new link" }),
    ).not.toBeOnTheScreen();
  });

  it("explains an expired link and still offers a new one", async () => {
    await renderNotice("failed", "person@example.com");

    expect(
      screen.getByText(
        "That confirmation link is invalid or has expired. Sign in again and we will send you a new one.",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Send a new link" }),
    ).toBeOnTheScreen();
  });

  it("resends the link back to this app", async () => {
    sendVerificationEmail.mockResolvedValue({ error: null });
    const { user } = await renderNotice("pending", "person@example.com");

    await user.press(screen.getByRole("button", { name: "Send a new link" }));

    expect(sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL: "/verify-email",
      email: "person@example.com",
    });
    expect(
      screen.getByText("Sent. Check your inbox for the new link."),
    ).toBeOnTheScreen();
  });

  it("cannot resend when it does not know the address", async () => {
    await renderNotice("pending");

    expect(
      screen.queryByRole("button", { name: "Send a new link" }),
    ).not.toBeOnTheScreen();
    expect(
      screen.getByText(
        "Open the link we emailed you to finish signing in. Open the link on this device to continue in the app.",
      ),
    ).toBeOnTheScreen();
  });
});
