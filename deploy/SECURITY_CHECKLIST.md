# Security checklist for the new Coolify project

Plan (2026-10-06): Fonzkart will be deployed as a **new** Coolify project. The old deployment is not touched.
This list is for setting up the new one so that it does not repeat the old stack's problems.

## Problems found in the old stack's files (do not copy them into the new project)

Found in the repository's `docker-compose.supabase.yml` and `supabase/kong.yml` while reviewing the live-notification
path:

| Problem | Why it matters |
|---|---|
| Supabase's REST API (`/rest/v1`) was published, and on the `supabase/postgres` image every table Prisma creates is readable **and writable** by the public `anon` role | The anon key is public (sent to every browser). Reproduced locally on the same image: `anon` could read `"User"."passwordHash"`. |
| The database password (also used as the SMTP password) was written in plain text in the compose file, in a OneDrive-synced folder | Treat that password as leaked. |
| The JWT secret default was a placeholder (`…change-me`) | Anyone knowing it can sign an all-powerful `service_role` token. |
| PostgreSQL (5432) and Supabase Studio (3001, no login) were published to the internet | Direct access to the database and an admin UI. |
| `prisma db push --accept-data-loss` runs on every start | A bad schema edit would silently drop columns. |

## Rules for the new project

1. **Use plain PostgreSQL, not the Supabase stack.** Fonzkart talks to the database only through Prisma. It does not
   use Supabase's REST API, Studio, GoTrue auth or the service-role key. Its one Supabase use, a Realtime subscription
   for the notification bell, has no Realtime service behind it in the old stack either: the bell works by polling
   every 30 seconds. A `postgres:15` service is enough. (If you do use the Supabase image again, run
   `deploy/supabase-lockdown.sql` on it first — tested: it blocks `anon`/`authenticated` on current and future tables
   and leaves the app working.)
2. **Do not publish the database port.** Let the website and the Spring service reach PostgreSQL over Coolify's
   internal network only.
3. **New secrets, generated fresh, kept only in Coolify's environment variables** — never in compose files or the
   repository: database password, `AUTH_SECRET` (session signing, shared by the website and Spring), SMTP password.
   Do not reuse any password from the old stack.
4. **Database changes through migrations**: prefer `prisma migrate deploy` over `prisma db push --accept-data-loss`
   in the start command. The repository has proper migrations, including the order-flow columns.
5. **Order of start-up**: database → website (creates/updates tables) → Spring service (it checks the tables at
   start-up and refuses to run if columns are missing).
6. **After the first start**: assign each partner's relationship manager on the Partners page.

## About the old deployment (left as is)

While it keeps running, the problems above still apply to it, including possible public read/write access to customer
data through its REST API if that API is reachable. Once the new project is live, shutting the old one down (after
taking any data you need) removes that risk. That decision, and the timing, are yours.

## Changed in the repository

- `docker-compose.supabase.yml` (old stack, kept for reference): the hard-coded passwords and JWT-secret default are
  replaced by required variables, so the leaked values are no longer in the file. The original is in
  `deploy/originals/` — delete that copy when you no longer need it, since it still contains them.
- `deploy/supabase-lockdown.sql`: only relevant if a Supabase image is used again (rule 1).
