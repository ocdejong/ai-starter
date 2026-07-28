import { describe, expect, it } from "vitest";

import {
  formatBacklog,
  readDependabotPulls,
  reviewBacklog,
  staleAfterDays,
  type DependabotPull,
} from "./dependency-backlog.ts";
import { type GitHubClient } from "./repository-host-apply.ts";

/**
 * The two halves this sensor is worth reading for: when a proposal has been
 * ignored long enough to count, and whether the report says which of the three
 * outcomes each one still needs.
 *
 * Both are proven without a network. The half that matters most is the silent
 * one — a pull request the arithmetic cannot age is a pull request that never
 * appears, which is precisely the failure that let seven reds sit for a week.
 */

const now = new Date("2026-08-10T12:00:00Z");

function daysBefore(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function pull(overrides: Partial<DependabotPull> = {}): DependabotPull {
  return {
    checks: "passing",
    createdAt: daysBefore(1),
    number: 1,
    title: "chore(deps): bump left-pad from 1.0.0 to 1.0.1",
    ...overrides,
  };
}

/** Replays canned responses in request order, recording what was asked for. */
function stubClient(
  responses: readonly { status: number; body: unknown }[],
): GitHubClient {
  const sent: { method: string; path: string; body: unknown }[] = [];
  let index = 0;

  return {
    request(method, path, body) {
      sent.push({ body: body ?? null, method, path });
      const response = responses[index] ?? { body: null, status: 404 };
      index += 1;
      return Promise.resolve({ ...response, message: "" });
    },
    sent,
  };
}

describe("reviewBacklog", () => {
  it("leaves a proposal alone until it has outlived a whole weekly cycle", () => {
    const reviewed = reviewBacklog(
      [pull({ createdAt: daysBefore(staleAfterDays - 0.1) })],
      now,
    );

    expect(reviewed.map((entry) => entry.stale)).toEqual([false]);
  });

  it("calls a proposal stale once it has, and says how old it is", () => {
    const reviewed = reviewBacklog(
      [pull({ createdAt: daysBefore(staleAfterDays + 5.5) })],
      now,
    );

    expect(reviewed[0]?.stale).toBe(true);
    expect(reviewed[0]?.ageInDays).toBe(staleAfterDays + 5);
  });

  it("reports the queue oldest first, because that is the order to work it", () => {
    const reviewed = reviewBacklog(
      [
        pull({ createdAt: daysBefore(3), number: 20 }),
        pull({ createdAt: daysBefore(30), number: 4 }),
        pull({ createdAt: daysBefore(12), number: 11 }),
      ],
      now,
    );

    expect(reviewed.map((entry) => entry.number)).toEqual([4, 11, 20]);
  });

  // A date the runtime cannot read makes every comparison against it false, so
  // the pull request would be quietly counted as fresh forever. A sensor that
  // can be silenced by malformed input is worse than no sensor.
  it("treats a timestamp it cannot read as stale rather than as fresh", () => {
    const reviewed = reviewBacklog([pull({ createdAt: "last Tuesday" })], now);

    expect(reviewed[0]?.stale).toBe(true);
    expect(reviewed[0]?.ageInDays).toBeUndefined();
  });
});

describe("formatBacklog", () => {
  it("names the outcome a green proposal still needs", () => {
    const report = formatBacklog(
      reviewBacklog(
        [
          pull({
            checks: "passing",
            createdAt: daysBefore(20),
            number: 7,
            title: "chore(deps-dev): bump @types/node",
          }),
        ],
        now,
      ),
    );

    expect(report).toContain("#7");
    expect(report).toContain("20 days");
    expect(report).toContain("passing");
    expect(report).toMatch(/merge/i);
  });

  // The distinction the backlog existed to lose: a green proposal nobody merged
  // and a red one nobody triaged are the same line in the pull request list and
  // completely different jobs.
  it("asks a red proposal for a decision rather than for a merge", () => {
    const report = formatBacklog(
      reviewBacklog(
        [pull({ checks: "failing", createdAt: daysBefore(20) })],
        now,
      ),
    );

    expect(report).toMatch(/repair|close/i);
    expect(report).toContain("docs/dependency-updates.md");
  });

  it("says the loop is moving when nothing has aged out", () => {
    const report = formatBacklog(reviewBacklog([pull()], now));

    expect(report).toMatch(/moving/i);
    expect(report).not.toMatch(/repair/i);
  });
});

describe("readDependabotPulls", () => {
  it("reads only what Dependabot proposed, so a stale branch of mine is not its fault", async () => {
    const client = stubClient([
      {
        body: [
          {
            created_at: daysBefore(9),
            head: { sha: "abc" },
            number: 3,
            title: "chore(deps): bump eslint",
            user: { login: "app/dependabot" },
          },
          {
            created_at: daysBefore(40),
            head: { sha: "def" },
            number: 4,
            title: "feat: something a person is writing",
            user: { login: "ocdejong" },
          },
        ],
        status: 200,
      },
      {
        body: { check_runs: [{ conclusion: "success", status: "completed" }] },
        status: 200,
      },
    ]);

    const pulls = await readDependabotPulls(client, "ocdejong/ai-starter");

    expect(pulls.map((entry) => entry.number)).toEqual([3]);
    expect(pulls[0]?.checks).toBe("passing");
  });

  it.each([
    [[{ conclusion: "failure", status: "completed" }], "failing"],
    [[{ conclusion: null, status: "in_progress" }], "pending"],
    [[{ conclusion: "skipped", status: "completed" }], "passing"],
    [[], "unknown"],
  ])("reads %j as %s", async (checkRuns, expected) => {
    const client = stubClient([
      {
        body: [
          {
            created_at: daysBefore(9),
            head: { sha: "abc" },
            number: 3,
            title: "chore(deps): bump eslint",
            user: { login: "app/dependabot" },
          },
        ],
        status: 200,
      },
      { body: { check_runs: checkRuns }, status: 200 },
    ]);

    const pulls = await readDependabotPulls(client, "ocdejong/ai-starter");

    expect(pulls[0]?.checks).toBe(expected);
  });

  it("refuses a response it cannot read rather than reporting an empty backlog", async () => {
    const client = stubClient([
      { body: { message: "Bad credentials" }, status: 401 },
    ]);

    await expect(
      readDependabotPulls(client, "ocdejong/ai-starter"),
    ).rejects.toThrow(/401/);
  });
});
