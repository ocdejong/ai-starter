# Security

Do not report vulnerabilities in a public issue. `pnpm repo:host` turns on GitHub private vulnerability reporting; add a private security contact here if you would rather be mailed.

Never commit `.env` files, Sentry auth tokens, database credentials, OAuth secrets, refresh tokens, or provider payloads. Rotate a credential immediately if it enters git history; deleting the line in a later commit is insufficient.

Run `pnpm repo:host` on a fresh clone. It is what applies secret scanning and push protection, Dependabot alerts and security updates, and the branch ruleset behind the default branch; `docs/repository-host.md` describes what each part buys and which parts need a public repository or GitHub Advanced Security.

OAuth tokens stored for third-party access are high-value secrets. Design encryption at rest, key rotation, revocation, minimum scopes, and audit logging before enabling sensitive calendar, email, financial, or health integrations.
