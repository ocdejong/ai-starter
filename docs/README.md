# Repository knowledge map

`AGENTS.md` is the binding entry point. This directory is the versioned source of truth behind it; load only the material relevant to the task.

- `engineering-principles.md`: mandatory for every code change; ranked golden principles and hard quality rules.
- `architecture.md`: dependency direction, domain boundaries, state, data, authentication, UI, and integration patterns.
- `testing.md`: verification levels, commands, and evidence expectations.
- `agent-engineering-research.md`: research basis and the ten source articles behind the golden principles; background reading, not task instructions.

Update a document in the same change when its contract changes. Prefer one canonical explanation plus links over duplicated guidance.

## Instruction surfaces

Every supported agent loads the contract on its own, from a file it already looks for: Claude Code and the Gemini CLI import `AGENTS.md` from `CLAUDE.md` and `GEMINI.md`, Cursor applies `.cursor/rules/repository.mdc` through its `alwaysApply` front matter, and GitHub Copilot reads `.github/copilot-instructions.md`. Those four files are generated from `packages/tooling/src/instruction-surfaces.ts`, which holds the one sentence they share; change the wording there and run `pnpm instructions:write`, never edit a pointer by hand.

A package earns its own `AGENTS.md` only when an agent editing it needs a rule the root contract does not already carry — `packages/tooling/AGENTS.md` is the current example, and its entry in the same module records why. Restating a root rule in a scoped file is a policy failure, not a convenience.

`pnpm instructions` enforces all of that and runs inside `pnpm verify`. It fails when a generated pointer no longer matches its source, when registered scoped instructions are missing or unreferenced from the root contract, when one rule sentence appears in two instruction surfaces, or when a markdown link, `@` import, or backticked path in any instruction or documentation file does not resolve. Each failure names the file and the command or edit that fixes it. `packages/tooling/src/instruction-policy.test.ts` seeds each of those violations into a temporary checkout, so the guard cannot regress unnoticed.
