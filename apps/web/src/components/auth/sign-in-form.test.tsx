import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { SignInForm } from "./sign-in-form";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  sendVerificationEmail: vi.fn(),
  signInEmail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("~/server/better-auth/client", () => ({
  authClient: {
    sendVerificationEmail: mocks.sendVerificationEmail,
    signIn: { email: mocks.signInEmail },
  },
}));

function renderForm(locale: "en" | "nl" = "en") {
  return render(
    <IntlTestProvider locale={locale}>
      <SignInForm />
    </IntlTestProvider>,
  );
}

async function submit(
  user: ReturnType<typeof userEvent.setup>,
  { email, password }: { email: string; password: string },
) {
  await user.type(screen.getByLabelText("Email address"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signInEmail.mockResolvedValue({ data: {}, error: null });
});

describe("SignInForm", () => {
  it("reports an invalid email without reaching the auth server", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, { email: "not-an-email", password: "a password" });

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeVisible();
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it("requires a password to be typed", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Email address"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter your password.")).toBeVisible();
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it("signs in with the normalized address and opens the dashboard", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, { email: "  Ada@Example.COM ", password: "a password" });

    await vi.waitFor(() => {
      expect(mocks.signInEmail).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "a password",
      });
    });
    expect(mocks.push).toHaveBeenCalledWith("/dashboard");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("surfaces a wrong credential pair without saying which half was wrong", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
    });
    const user = userEvent.setup();
    renderForm();

    await submit(user, {
      email: "ada@example.com",
      password: "wrong password",
    });

    expect(
      await screen.findByText(
        "That email address and password do not match an account.",
      ),
    ).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("explains the unverified 403 and offers another confirmation link", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", status: 403 },
    });
    mocks.sendVerificationEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    renderForm();

    await submit(user, { email: "ada@example.com", password: "a password" });

    expect(
      await screen.findByText("Confirm your email address first"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Your account is not confirmed yet, so we sent a fresh link to ada@example.com.",
      ),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Send a new link" }));

    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL: "/verify-email",
      email: "ada@example.com",
    });
    expect(
      await screen.findByText("Sent. Check your inbox for the new link."),
    ).toBeVisible();
  });

  it("falls back to a generic failure for an unrecognised error", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "SOMETHING_ELSE", status: 500 },
    });
    const user = userEvent.setup();
    renderForm();

    await submit(user, { email: "ada@example.com", password: "a password" });

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
  });

  it("renders in Dutch when the catalog locale is nl", async () => {
    const user = userEvent.setup();
    renderForm("nl");

    await user.type(screen.getByLabelText("E-mailadres"), "nope");
    await user.click(screen.getByRole("button", { name: "Inloggen" }));

    expect(
      await screen.findByText("Vul een geldig e-mailadres in."),
    ).toBeVisible();
  });
});
