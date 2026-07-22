# Security

Do not report vulnerabilities in a public issue. Once this starter is published as a repository, enable GitHub private vulnerability reporting or provide a private security contact here.

Never commit `.env` files, Sentry auth tokens, database credentials, OAuth secrets, refresh tokens, or provider payloads. Rotate a credential immediately if it enters git history; deleting the line in a later commit is insufficient.

Before production, enable GitHub secret scanning and push protection, Dependabot alerts and security updates, CodeQL, protected `main`, required CI checks, review approval, stale-review dismissal, conversation resolution, and blocked force pushes/deletions.

OAuth tokens stored for third-party access are high-value secrets. Design encryption at rest, key rotation, revocation, minimum scopes, and audit logging before enabling sensitive calendar, email, financial, or health integrations.
