import { describe, expect, it } from "vitest";

import { createPostInputSchema } from "./post";

describe("createPostInputSchema", () => {
  it("rejects an empty post name", () => {
    expect(createPostInputSchema.safeParse({ name: "   " }).success).toBe(
      false,
    );
  });
});
