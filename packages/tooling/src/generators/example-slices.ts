import { type FeatureShape } from "./shape.ts";

export type ExampleSlice = {
  readonly name: string;
  readonly shape: FeatureShape;
};

/**
 * The slices this repository guarantees are unmodified generator output.
 *
 * `golden-path.test.ts` holds each of them to the templates byte for byte, which
 * is what makes the committed example the worked example rather than a snapshot
 * of one. Generation adds nothing here on purpose: a product edits what it
 * generates, and pinning a product's own feature would fail the moment it did
 * the thing it generated the feature to do. Removal takes an entry away, because
 * a slice that is gone cannot be held to anything.
 *
 * An empty list is a valid state — it is what a product that removed the example
 * has — and the pin passes over it without asserting anything.
 */
export const pinnedExampleSlices: readonly ExampleSlice[] = [
  { name: "announcement", shape: "current" },
];
