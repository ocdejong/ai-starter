// Next.js aliases the `server-only` marker to a no-op in its server build; a
// bare vitest run has no bundler doing that, so the integration config maps the
// marker here. This only affects the marker import, never real database code.
export {};
