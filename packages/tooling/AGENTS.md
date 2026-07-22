# Repository tooling

Additions to the root contract for this package only. Everything the root `AGENTS.md` says still applies.

- Node executes these files directly by stripping types rather than compiling them. Enums, parameter properties and `namespace` are rejected at runtime even though they typecheck, and every local import keeps its `.ts` extension.
- Each command in `src/bin` answers `--help` with a line beginning `Usage: pnpm `, and stays thin: parsing arguments, printing, and setting an exit code. `src/bin/cli.test.ts` executes every command to prove Node can still run it.
- Modules take the repository root as a parameter instead of reading `repositoryRoot` themselves, so a test can point them at a fixture tree.
