import { describe, expect, it, vi } from "vitest";

import type { PostRepository, TRPCContext } from "../context";
import { createCaller } from "../root";

const storedPost = {
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdById: "user-1",
  id: "post-1",
  name: "A bounded context",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const createContext = (posts: PostRepository): TRPCContext => ({
  groups: {
    findMembership: vi.fn(async () => null),
    listMembers: vi.fn(async () => []),
    listMemberships: vi.fn(async () => []),
  },
  headers: new Headers(),
  posts,
  session: { activeGroupId: null, user: { id: "user-1" } },
});

describe("postRouter", () => {
  it("creates a post through the repository contract", async () => {
    const posts: PostRepository = {
      create: vi.fn(async () => storedPost),
      findLatestByUserId: vi.fn(async () => null),
    };

    const result = await createCaller(createContext(posts)).post.create({
      name: storedPost.name,
    });

    expect(posts.create).toHaveBeenCalledWith({
      createdById: "user-1",
      name: storedPost.name,
    });
    expect(result).toEqual(storedPost);
  });

  it("queries only the signed-in user's latest post", async () => {
    const posts: PostRepository = {
      create: vi.fn(async () => storedPost),
      findLatestByUserId: vi.fn(async () => storedPost),
    };

    const result = await createCaller(createContext(posts)).post.getLatest();

    expect(posts.findLatestByUserId).toHaveBeenCalledWith("user-1");
    expect(result).toEqual(storedPost);
  });
});
