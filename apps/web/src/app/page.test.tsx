import { messages } from "@ai-starter/i18n";
import { render, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";

vi.mock("next-intl/server", () => ({
  getTranslations: () =>
    createTranslator({
      locale: "en",
      messages: messages.en,
      namespace: "home",
    }),
}));
vi.mock("~/server/better-auth/server", () => ({
  getSession: () => Promise.resolve(null),
}));
vi.mock("~/server/better-auth", () => ({
  auth: { api: { signInSocial: vi.fn() } },
  primarySocialProvider: null,
}));
vi.mock("~/server/ai", () => ({ isChatConfigured: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("~/i18n/set-locale", () => ({ setLocale: vi.fn() }));

import Home from "./page";

describe("Home without vendor credentials", () => {
  it("renders the ways in and passes the keyless state to the real chat component", async () => {
    render(<IntlTestProvider>{await Home()}</IntlTestProvider>);

    expect(
      screen.getByRole("heading", { name: "AI Starter" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A full-stack starter your coding agents can extend."),
    ).toBeInTheDocument();
    const ways = within(
      screen.getByRole("navigation", { name: "Get started" }),
    );
    expect(
      ways.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/sign-up");
    expect(ways.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(
      ways.getByText(
        "Add Google or GitHub OAuth credentials to offer social sign-in as well.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ask the assistant" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Chat is not configured. Set ANTHROPIC_API_KEY to enable it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Type a message…")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
