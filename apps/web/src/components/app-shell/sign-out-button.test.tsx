import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestProvider } from "~/test/intl";
import { SignOutButton } from "./sign-out-button";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const signOut = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("~/server/better-auth/client", () => ({
  authClient: { signOut },
}));

describe("SignOutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ends the session and returns the visitor to the landing page", async () => {
    const user = userEvent.setup();
    render(
      <IntlTestProvider>
        <SignOutButton />
      </IntlTestProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/");
    });
    // The landing page is a server component that reads the session, so the
    // client cache has to be discarded or it renders the signed-in state.
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});
