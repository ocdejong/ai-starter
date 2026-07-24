import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { SignInForm } from "./sign-in-form";

jest.mock("../../auth/client", () => ({
  authClient: { signIn: { email: jest.fn() } },
}));

const signInEmail = jest.mocked(authClient.signIn.email);

/**
 * `userEvent`, not `fireEvent`: under React 19 a bare `fireEvent` does not flush
 * the re-render before the next interaction, so a button pressed straight after
 * typing still sees the empty state. `userEvent` awaits each step.
 *
 * `render` is typed async in @testing-library/react-native v14.
 */
async function renderForm() {
  const props = {
    onCreateAccount: jest.fn(),
    onForgotPassword: jest.fn(),
    onNeedsVerification: jest.fn(),
  };
  const user = userEvent.setup();

  await render(
    <TestProviders>
      <SignInForm {...props} />
    </TestProviders>,
  );

  async function signIn(email: string, password: string) {
    await user.type(screen.getByLabelText("Email address"), email);
    await user.type(screen.getByLabelText("Password"), password);
    await user.press(screen.getByRole("button", { name: "Sign in" }));
  }

  return { ...props, signIn, user };
}

describe("SignInForm", () => {
  beforeEach(() => {
    signInEmail.mockReset();
  });

  it("refuses to send credentials that cannot be valid", async () => {
    const { signIn } = await renderForm();

    await signIn("not-an-address", "");

    expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
    expect(screen.getByText("Enter your password.")).toBeOnTheScreen();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("submits the trimmed credentials once they are valid", async () => {
    signInEmail.mockResolvedValue({ error: null });
    const { signIn } = await renderForm();

    await signIn("  person@example.com ", "correct horse");

    expect(signInEmail).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "correct horse",
    });
  });

  it("shows one message for a refused email/password pair", async () => {
    signInEmail.mockResolvedValue({
      error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
    });
    const { signIn } = await renderForm();

    await signIn("person@example.com", "correct horse");

    expect(
      screen.getByText(
        "That email address and password do not match an account.",
      ),
    ).toBeOnTheScreen();
  });

  it("routes an unverified account to the confirmation screen", async () => {
    signInEmail.mockResolvedValue({
      error: { code: "EMAIL_NOT_VERIFIED", status: 403 },
    });
    const { onNeedsVerification, signIn } = await renderForm();

    await signIn("person@example.com", "correct horse");

    expect(onNeedsVerification).toHaveBeenCalledWith("person@example.com");
  });

  it("reports an unreachable server rather than blaming the credentials", async () => {
    signInEmail.mockRejectedValue(new TypeError("Network request failed"));
    const { signIn } = await renderForm();

    await signIn("person@example.com", "correct horse");

    expect(
      screen.getByText(
        "The server could not be reached. Check your connection and try again.",
      ),
    ).toBeOnTheScreen();
  });

  it("offers the way to the other account screens", async () => {
    const { onCreateAccount, onForgotPassword, user } = await renderForm();

    await user.press(
      screen.getByRole("link", { name: "Forgot your password?" }),
    );
    await user.press(
      screen.getByRole("link", { name: "No account yet? Create one" }),
    );

    expect(onForgotPassword).toHaveBeenCalled();
    expect(onCreateAccount).toHaveBeenCalled();
  });

  it("renders in Dutch when the catalog says so", async () => {
    await render(
      <TestProviders locale="nl">
        <SignInForm
          onCreateAccount={jest.fn()}
          onForgotPassword={jest.fn()}
          onNeedsVerification={jest.fn()}
        />
      </TestProviders>,
    );

    expect(screen.getByLabelText("E-mailadres")).toBeOnTheScreen();
    expect(screen.getByText("Wachtwoord vergeten?")).toBeOnTheScreen();
  });
});
