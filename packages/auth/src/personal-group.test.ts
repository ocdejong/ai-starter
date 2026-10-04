import { createDatabaseClient } from "@ai-starter/db";
import { describe, expect, it, vi } from "vitest";

import { createPersonalGroup } from "./personal-group";

const user = { email: "ada@example.com", id: "user-1", name: "Ada" };

// Constructing the client does not open a connection, and `$transaction` is
// replaced, so these tests exercise only how the call is retried.
const unusedDatabase = () =>
  createDatabaseClient("postgresql://localhost:5432/unused");

describe("createPersonalGroup", () => {
  it("tries once more when a concurrent insert wins the slug", async () => {
    const database = unusedDatabase();
    const transaction = vi
      .spyOn(database, "$transaction")
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce("group-1");

    await expect(createPersonalGroup(database, user)).resolves.toBe("group-1");
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failure that is not a unique violation", async () => {
    const database = unusedDatabase();
    const failure = new Error("connection lost");
    const transaction = vi
      .spyOn(database, "$transaction")
      .mockRejectedValue(failure);

    await expect(createPersonalGroup(database, user)).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("gives up when the retry loses the race as well", async () => {
    const database = unusedDatabase();
    const transaction = vi
      .spyOn(database, "$transaction")
      .mockRejectedValue({ code: "P2002" });

    await expect(createPersonalGroup(database, user)).rejects.toEqual({
      code: "P2002",
    });
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
