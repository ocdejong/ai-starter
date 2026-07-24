import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { SignUpForm } from "./sign-up-form";

const mocks = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  signUpEmail: vi.fn(),
}));

vi.mock("~/server/better-auth/client", () => ({
  authClient: {
    sendVerificationEmail: mocks.sendVerificationEmail,
    signUp: { email: mocks.signUpEmail },
  },
}));

function renderForm() {
  return render(
    <IntlTestProvider>
      <SignUpForm />
    </IntlTestProvider>,
  );
}

async function submit(
  user: ReturnType<typeof userEvent.setup>,
  { email, name, password }: { email: string; name: string; password: string },
) {
  await user.type(screen.getByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Email address"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

const valid = {
  email: "ada@example.com",
  name: "Ada Lovelace",
  password: "a long enough password",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signUpEmail.mockResolvedValue({ data: {}, error: null });
});

describe("SignUpForm", () => {
  it("names the minimum length when the password is too short", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, { ...valid, password: "short" });

    expect(await screen.findByText("Use at least 8 characters.")).toBeVisible();
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
  });

  it("requires a name", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Email address"), valid.email);
    await user.type(screen.getByLabelText("Password"), valid.password);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Enter your name.")).toBeVisible();
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
  });

  it("registers with normalized values and points the visitor at their inbox", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user, {
      ...valid,
      email: "  Ada@Example.COM ",
      name: " Ada Lovelace ",
    });

    await vi.waitFor(() => {
      expect(mocks.signUpEmail).toHaveBeenCalledWith({
        callbackURL: "/verify-email",
        email: "ada@example.com",
        name: "Ada Lovelace",
        password: valid.password,
      });
    });
    expect(await screen.findByText("Confirm your email address")).toBeVisible();
    expect(
      screen.getByText(
        "We sent a confirmation link to ada@example.com. Open it to finish creating your account.",
      ),
    ).toBeVisible();
  });

  it("offers another confirmation link from the inbox panel", async () => {
    mocks.sendVerificationEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    renderForm();

    await submit(user, valid);
    await user.click(
      await screen.findByRole("button", { name: "Send a new link" }),
    );

    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL: "/verify-email",
      email: valid.email,
    });
  });

  it("keeps the form on screen when registration fails", async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: "FAILED_TO_CREATE_USER", status: 422 },
    });
    const user = userEvent.setup();
    renderForm();

    await submit(user, valid);

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeVisible();
    expect(screen.getByLabelText("Email address")).toBeVisible();
  });
});
