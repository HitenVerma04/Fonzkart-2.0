# Run Fonzkart locally

```bash
bash scripts/local/start.sh
```

Needs Docker only. The first start installs dependencies into the Docker volume `fonzkart-local-deps` (a few
minutes); later starts take about a minute. Stop with Ctrl+C, then `bash scripts/local/stop.sh`.

| What | Where |
|---|---|
| Website | http://localhost:3000 |
| Admin panel | http://localhost:3000/admin |
| Emails (sign-up codes, order mails) — caught locally, never sent | http://localhost:8025 |

Every start recreates the database from the test seeds plus `demo-seed.sql` (demo orders at every stage). Changes
you make in the app are lost on the next start. Code changes need a restart (the code is copied in at start).

## Demo logins (local only — every password is `pw`)

| Role | Email | What to look at |
|---|---|---|
| Super admin | admin@fonzkart.in | everything; Partners page: set each partner's RM |
| Admin | ops@example.test | same, without super-admin extras |
| Relationship manager (Rita) | rm@example.test | Orders (her partners + unrouted), Price Approval tab, RM Dashboard |
| Zonal head | zh1@example.test | Chennai territory |
| Partner One | p1@example.test | own orders, assign own executives, approve prices |
| Field executive (Kumar) | fe@example.test | My Pickups: verification, price revision, "I have paid the customer" |
| Customer | cust@example.test | My Orders: the tracker on every demo order |

The Spring Boot backend is not started: the website does not call it yet (see `backend/README.md`).
