import { render, screen, userEvent } from "@testing-library/react-native";

import { authClient } from "../../auth/client";
import { TestProviders } from "../../test/providers";
import { SignUpForm } from "./sign-up-form";

jest.mock("../../auth/client", () => ({
  authClient: { signUp: { email: jest.fn() } },
}));

const signUpEmail = jest.mocked(authClient.signUp.email);

async function renderForm() {
  const props = { onSignIn: jest.fn(), onVerificationSent: jest.fn() };
  const user = userEvent.setup();

  await render(
    <TestProviders>
      <SignUpForm {...props} />
    </TestProviders>,
  );

  async function signUp(name: string, email: string, password: string) {
    await user.type(screen.getByLabelText("Name"), name);
    await user.type(screen.getByLabelText("Email address"), email);
    await user.type(screen.getByLabelText("Password"), password);
    await user.press(screen.getByRole("button", { name: "Create account" }));
  }

  return { ...props, signUp };
}

describe("SignUpForm", () => {
  beforeEach(() => {
    signUpEmail.mockReset();
  });

  it("names every field the reader must correct", async () => {
    const { signUp } = await renderForm();

    await signUp("  ", "nope", "short");

    expect(screen.getByText("Enter your name.")).toBeOnTheScreen();
    expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
    expect(screen.getByText("Use at least 8 characters.")).toBeOnTheScreen();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("asks the emailed link to return to this app", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    const { onVerificationSent, signUp } = await renderForm();

    await signUp("Ada Lovelace", "ada@example.com", "correct horse");

    expect(signUpEmail).toHaveBeenCalledWith({
      callbackURL: "/verify-email",
      email: "ada@example.com",
      name: "Ada Lovelace",
      password: "correct horse",
    });
    expect(onVerificationSent).toHaveBeenCalledWith("ada@example.com");
  });

  it("keeps the reader on the form when the server refuses", async () => {
    signUpEmail.mockResolvedValue({
      error: { code: "FAILED_TO_CREATE_USER", status: 500 },
    });
    const { onVerificationSent, signUp } = await renderForm();

    await signUp("Ada Lovelace", "ada@example.com", "correct horse");

    expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeOnTheScreen();
    expect(onVerificationSent).not.toHaveBeenCalled();
  });

  it("renders in Dutch when the catalog says so", async () => {
    await render(
      <TestProviders locale="nl">
        <SignUpForm onSignIn={jest.fn()} onVerificationSent={jest.fn()} />
      </TestProviders>,
    );

    expect(screen.getByLabelText("Naam")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Account aanmaken" }),
    ).toBeOnTheScreen();
  });
});
