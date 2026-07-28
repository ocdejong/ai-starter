import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { SocialSignIn, type SocialSignInProps } from "./social-sign-in";

function renderSocialSignIn(props: Partial<SocialSignInProps> = {}) {
  const signIn = vi.fn();
  render(
    <IntlTestProvider>
      <SocialSignIn provider={null} signIn={signIn} {...props} />
    </IntlTestProvider>,
  );
  return { signIn };
}

describe("SocialSignIn", () => {
  it("names the provider a deployment configured", () => {
    renderSocialSignIn({ provider: "google" });

    expect(
      screen.getByRole("button", { name: "Sign in with google" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Add Google or GitHub OAuth credentials to offer social sign-in as well.",
      ),
    ).not.toBeInTheDocument();
  });

  it("starts the redirect when the button is used", async () => {
    const { signIn } = renderSocialSignIn({ provider: "github" });

    await userEvent.click(
      screen.getByRole("button", { name: "Sign in with github" }),
    );

    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("explains how to get one when no credentials are configured", () => {
    renderSocialSignIn();

    expect(
      screen.getByText(
        "Add Google or GitHub OAuth credentials to offer social sign-in as well.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
