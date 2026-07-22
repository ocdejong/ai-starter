# Agent-engineering research basis

“Most praised” has no objective leaderboard, so this is a curated set of ten high-signal, widely discussed primary sources from teams and practitioners operating coding agents at meaningful scale. The repository rules synthesize their recurring lessons rather than copying any single workflow.

1. [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/) — OpenAI: repository knowledge, agent legibility, mechanically enforced architecture, runtime feedback, and continuous entropy cleanup.
2. [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Anthropic: context is finite; use the smallest high-signal context, progressive disclosure, compaction, and structured memory.
3. [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — Anthropic: incremental work, explicit feature state, clean handoffs, git checkpoints, and end-to-end verification.
4. [Minions: Stripe’s one-shot, end-to-end coding agents](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents) and [Part 2](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2) — Stripe: isolated reproducible environments, narrowly scoped tools/rules, deterministic workflow nodes, and feedback shifted left.
5. [Scaling long-running autonomous coding](https://cursor.com/blog/scaling-agents) — Cursor: focused workers, separate planning and judgment, fresh contexts, and explicit coordination instead of shared-state improvisation.
6. [12 Factor Agents](https://www.humanlayer.com/blog/12-factor-agents) — HumanLayer: own context and control flow, use structured actions, keep agents small, and reserve deterministic code for deterministic work.
7. [Agentic Engineering Patterns](https://simonwillison.net/guides/agentic-engineering-patterns/) — Simon Willison: red-green TDD, tests first, manual/runtime verification, small reviewable changes, and responsibility for generated output.
8. [Agentic Coding Recommendations](https://lucumr.pocoo.org/2025/6/12/agentic-coding/) — Armin Ronacher: stable technology, fast tools, explicit simple code, visible security checks, isolated parallel work, and timely refactoring.
9. [Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html) — Thoughtworks: combine feedforward guidance with feedback sensors; prefer fast deterministic controls and continuously monitor drift.
10. [Agent Skills](https://addyosmani.com/blog/agent-skills/) — Addy Osmani: process over prose, anti-rationalization rules, non-negotiable evidence, progressive disclosure, and strict scope discipline.

## Repeated findings

Across the sources, model quality was rarely the only bottleneck. The strongest recurring pattern was an inspectable repository with clear contracts, small tasks, deterministic checks, realistic runtime feedback, and safe isolated environments. The specifically agentic lesson is that guidance must be concise and discoverable, while important constraints must be executable: agents will rationalize around prose and reproduce whatever patterns the repository already rewards.
