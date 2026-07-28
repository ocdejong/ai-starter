import { describe, expect, it } from "vitest";

import { icuArguments } from "./icu-arguments";

/**
 * The cases that separate an argument from a submessage.
 *
 * Every catalog message this repository ships today is read correctly by a
 * regular expression, which is why the parity test carried one for four stages.
 * The two shapes below are the ones it cannot read, and both are shapes a
 * translator writes without thinking: a plural branch short enough to be one
 * word, and an argument interpolated inside a branch.
 */
describe("icuArguments", () => {
  it("reads a plain argument", () => {
    expect([...icuArguments("Logged in as {name}")]).toEqual(["name"]);
  });

  it("reads every argument in a message", () => {
    expect([...icuArguments("{browser} on {platform}")]).toEqual([
      "browser",
      "platform",
    ]);
  });

  it("reads an argument with a type and a style", () => {
    expect([...icuArguments("Expires {expires, date, medium}")]).toEqual([
      "expires",
    ]);
  });

  it("reads only the selector argument of a plural", () => {
    expect([
      ...icuArguments(
        "{count, plural, =0 {No announcements yet} one {# announcement} other {# announcements}}",
      ),
    ]).toEqual(["count"]);
  });

  it("does not read a one-word plural branch as an argument name", () => {
    expect([
      ...icuArguments(
        "{count, plural, =0 {Saved} one {# item} other {# items}}",
      ),
    ]).toEqual(["count"]);
  });

  it("does not read a select case as an argument name", () => {
    expect([
      ...icuArguments("{role, select, owner {Eigenaar} other {Lid}}"),
    ]).toEqual(["role"]);
  });

  it("reads an argument nested inside a submessage", () => {
    expect([
      ...icuArguments(
        "{count, plural, one {# for {name}} other {# for {name}}}",
      ),
    ]).toEqual(["count", "name"]);
  });

  it("ignores the plural `#` and an offset", () => {
    expect([
      ...icuArguments(
        "{count, plural, offset:1 one {# other} other {# others}}",
      ),
    ]).toEqual(["count"]);
  });

  it("finds nothing in a message that interpolates nothing", () => {
    expect([...icuArguments("Nothing has been superseded yet.")]).toEqual([]);
  });
});
