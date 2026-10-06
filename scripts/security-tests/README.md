# Website security regression tests

Tests for the security hardening of the Next.js server code (see `SECURITY_HARDENING_REPORT.md` in the repository
root). They run the real server actions, route handler and admin pages against PostgreSQL, inside Docker.

```bash
scripts/security-tests/run.sh test        # run the tests (default)
scripts/security-tests/run.sh originals   # run them against the pre-hardening code: they are expected to FAIL
scripts/security-tests/run.sh golden      # regenerate the Spring Boot parity fixtures (staff, auth, pricing, tokens)
```

Requirements: Docker and bash (Git Bash on Windows). Nothing is installed into the project, and the project is
mounted read-only. The first run downloads the test dependencies into the Docker volume `fonzkart-sec-deps`; later
runs reuse it. Containers and the network are removed when the script ends. SMTP points at a closed local port
(`127.0.0.1:1`): without `SMTP_HOST` the website would fall back to the production mail server.

## How it works

- `run.sh` starts PostgreSQL 15 with `backend/src/test/resources/db/01-prisma-schema.sql` and `03-staff-seed.sql`
  (the same seed as the Spring Boot staff tests; every user's password is `pw`), then runs a Node 22 container.
- `in-container.sh` copies the project code to `/app` (`prepare.mjs`), generates the Prisma client and runs the script.
- `prepare.mjs` replaces every UI component under `components/` with a placeholder that keeps its export names.
  Pages run as plain functions and the tests read the props they pass to each component, so no browser libraries
  are needed. `--originals` puts back the files saved in `security-hardening/originals/`.
- `stubs/` replaces `next/*`, `react` and `lucide-react`: cookies come from a per-actor jar (`harness.ts → as()`),
  `redirect()` throws like Next.js, and JSX is captured as data.

## Files

| File | Purpose |
|---|---|
| `security.test.ts` | regression tests of the first hardening phase (debug endpoint, city/partner pincodes, rider passwords and cookie, secrets in pages) |
| `permissions.test.ts` | staff-permission regression tests: each role against each protected operation and page |
| `logging.test.ts` | authentication flows must never log passwords, hashes, codes, tokens or the secret |
| `orders.test.ts` | order flow (ORDER_FLOW_CHANGES.md): routing to partners, who sees and acts on which order, partner/executive assignment, price approval before pickup, payouts, scoped fail/restore/delete/bulk, RM dashboard and partner RMs, customer tracker |
| `notifications.test.ts` | notifications: callers identified by session, not by arguments; mark-read limited to the caller; no browser-callable create; scoped "order waiting" count |
| `all.test.ts` | runs all test files in one process |
| `harness.ts` | actors and cookie jars, sign-in, page rendering behind the admin layout |
| `staff-ref.ts`, `auth-ref.ts`, `pricing-ref.ts` | run the staff, auth and pricing scenarios in `backend/src/test/resources/golden` and write their `*-expected.json` (auth also needs the Mailpit mail catcher, which `run.sh` starts) |
| `token-fixture.ts` | writes `golden/executive-token-fixture.json` (executive tokens for fixed inputs) |
| `run.sh`, `in-container.sh`, `prepare.mjs`, `stubs/`, `package.json` | the Docker set-up |

After changing website behaviour that a scenario covers, run `run.sh golden` and then `mvn verify` in
`backend/` so Spring Boot is checked against the new behaviour.
