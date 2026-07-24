import { describe, expect, it } from "vitest";

import { parsePublishedPort } from "./container-runtime.ts";

/** Wraps one container's fields the way `docker inspect` prints them. */
function inspectJson(container: object): string {
  return JSON.stringify([container]);
}

describe("parsePublishedPort", () => {
  it("reads the live binding of a running container", () => {
    expect(
      parsePublishedPort(
        inspectJson({
          HostConfig: {
            PortBindings: { "5432/tcp": [{ HostIp: "", HostPort: "5436" }] },
          },
          NetworkSettings: {
            Ports: {
              "5432/tcp": [
                { HostIp: "0.0.0.0", HostPort: "5436" },
                { HostIp: "::", HostPort: "5436" },
              ],
            },
          },
        }),
      ),
    ).toBe(5436);
  });

  it("falls back to the creation-time binding of a stopped container", () => {
    expect(
      parsePublishedPort(
        inspectJson({
          HostConfig: {
            PortBindings: { "5432/tcp": [{ HostIp: "", HostPort: "5433" }] },
          },
          NetworkSettings: { Ports: {} },
        }),
      ),
    ).toBe(5433);
  });

  it("ignores an exposed but unpublished postgres port", () => {
    expect(
      parsePublishedPort(
        inspectJson({
          HostConfig: { PortBindings: {} },
          NetworkSettings: { Ports: { "5432/tcp": null } },
        }),
      ),
    ).toBeUndefined();
  });

  it("ignores bindings for other container ports", () => {
    expect(
      parsePublishedPort(
        inspectJson({
          HostConfig: {
            PortBindings: { "8080/tcp": [{ HostIp: "", HostPort: "8080" }] },
          },
          NetworkSettings: { Ports: {} },
        }),
      ),
    ).toBeUndefined();
  });

  it("skips a binding whose host port is not a number", () => {
    expect(
      parsePublishedPort(
        inspectJson({
          NetworkSettings: {
            Ports: { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "" }] },
          },
        }),
      ),
    ).toBeUndefined();
  });

  it("returns undefined when the container list is empty", () => {
    expect(parsePublishedPort("[]")).toBeUndefined();
  });

  it("returns undefined for unparseable output", () => {
    expect(parsePublishedPort("Error: no such object")).toBeUndefined();
  });
});
