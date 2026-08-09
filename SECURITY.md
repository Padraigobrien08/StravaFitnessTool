# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via GitHub's [**Report a vulnerability**](https://github.com/Padraigobrien08/strideiq/security/advisories/new) (Security → Advisories), which keeps the report confidential until a fix is ready.

Include, where possible:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected version / commit.

We aim to acknowledge reports within a few days and to coordinate a fix and disclosure timeline with you.

## Scope and notes

StrideIQ is a **self-hosted, single-user** application — you run it on your own machine with your own Strava app and database. Keep in mind:

- **Never commit secrets.** `.env.local` is git-ignored; only `.env.example` (no values) is tracked. Your Strava tokens live in your own database.
- **Strava exports contain personal data.** The `export_*/` folders are git-ignored — don't commit them.
- Because each Strava account maps to a single API application, there is no shared multi-tenant deployment to attack; the main surface is your local instance and your own credentials.

Dependency vulnerabilities are tracked via Dependabot; run `npm audit` locally to check your install.
