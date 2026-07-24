// Next.js aliases the `server-only` marker to a no-op in its server build; a
// vitest run has no bundler doing that, so the config maps the marker here for
// tests that import server modules. It only affects the marker import.
export {};
