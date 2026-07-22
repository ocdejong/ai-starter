import { describe, expect, it } from "vitest";

import { createPostInputSchema } from "./post";

describe("createPostInputSchema", () => {
  it("rejects an empty post name", () => {
    expect(createPostInputSchema.safeParse({ name: "   " }).success).toBe(
      false,
    );
  });

  it("rejects a post name longer than the database limit", () => {
    expect(
      createPostInputSchema.safeParse({ name: "a".repeat(201) }).success,
    ).toBe(false);
  });
});
