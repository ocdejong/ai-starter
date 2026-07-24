/**
 * Reading the dev mailbox, as its own entry point. The package index carries the
 * `server-only` marker so no client bundle can pull the vendor adapters in, and
 * that marker throws in any runtime that is not a React server — including a
 * Playwright worker. Inspecting the mailbox is exactly what a local flow and a
 * browser journey need to do, so it is reachable without that marker.
 */
export { readMailbox, type StoredEmail } from "./adapters/dev-mailbox-sender";
