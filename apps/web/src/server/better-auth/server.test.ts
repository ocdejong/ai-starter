import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionResult = vi.hoisted(() => ({
  current: null as { user: { email: string } } | null,
}));
const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    // Next's `redirect` throws to unwind the render; the real control flow
    // matters here, because `requireSession` returns a non-nullable session only
    // because nothing after the call runs.
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock(".", () => ({
  auth: {
    api: { getSession: () => Promise.resolve(getSessionResult.current) },
  },
}));

const { requireSession } = await import("./server");

describe("requireSession", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("returns the session when the visitor has one", async () => {
    getSessionResult.current = { user: { email: "ada@example.com" } };

    await expect(requireSession()).resolves.toStrictEqual({
      user: { email: "ada@example.com" },
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session to sign in", async () => {
    getSessionResult.current = null;

    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
