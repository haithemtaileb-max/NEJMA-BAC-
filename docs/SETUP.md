# Step-by-step setup

## 0. Prerequisites

- **Node.js 20.9+** (22 LTS recommended) and npm
- For a real backend, either:
  - a free **Supabase cloud** project (https://supabase.com), or
  - **Docker** to run Supabase locally with the CLI (installed as a dev dependency)

## 1. Install and run in demo mode (2 minutes)

```bash
git clone <this repo> nejma-med && cd nejma-med
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase variables the app runs in **demo mode**: a yellow
banner says so, there are no accounts, and sample content is served from `src/content`.
Everything works (onboarding, dashboard, practice, exam simulator, 3D viewer). State is kept
in server memory and lost on restart.

## 2a. Connect a Supabase cloud project

1. Create a project (pick an EU region, e.g. *Frankfurt* or *Paris*, closest to Algeria).
2. Link and push the schema + starter content:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --include-seed
   ```

   (Without the CLI: paste `supabase/migrations/*.sql`, then `supabase/seed.sql`, into the SQL editor.)
3. **Authentication → URL configuration**
   - Site URL: `http://localhost:3000` (your production URL later)
   - Redirect URLs: `http://localhost:3000/auth/confirm`, `https://<your-domain>/auth/confirm`
4. **Authentication → Email templates** (optional): translate the confirmation e-mail to French.
   The default `{{ .ConfirmationURL }}` works with `/auth/confirm`.
5. Create `.env.local` from `.env.example`:

   ```bash
   cp .env.example .env.local
   # NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   # NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   (Project Settings → API Keys)
   ```

6. `npm run dev`, register, confirm the e-mail, pick your major/year.

## 2b. …or run Supabase locally (Docker)

```bash
npm run db:start        # starts Postgres, Auth, Storage, Studio (first run downloads images)
npx supabase status     # shows the API URL and the publishable key
npm run db:reset        # re-applies migrations + seed.sql any time
```

Copy the **API URL** into `NEXT_PUBLIC_SUPABASE_URL` and the **Publishable key** into
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.

- Studio (DB admin UI): http://127.0.0.1:54323
- E-mails sent by Supabase Auth land in the local mail catcher: http://127.0.0.1:54324.
  E-mail confirmation is disabled locally (`[auth.email] enable_confirmations = false` in
  `supabase/config.toml`), so signing up logs you in directly.

## 3. Make yourself an admin

In the SQL editor / Studio:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Moderators/admins can publish questions and summaries; contributors can draft them.

## 4. Add content

- **Curriculum and sample QCMs for a fresh database**: edit `src/content/curriculum.ts` /
  `src/content/sample-qcms.ts`, then `npm run db:seed:generate` (rewrites `supabase/seed.sql`;
  a unit test fails if you forget).
- **Production content**: insert directly into `modules`, `units`, `courses`, `qcms`,
  `qcm_options` (Studio or SQL). A question must have its options in the same transaction
  when published (a deferred constraint checks it). An admin UI and a CSV importer are on the
  roadmap.
- **3D models**: see `public/models/README.md`.

## 5. Quality checks

```bash
npm run lint
npm run typecheck
npm test                                  # unit tests (DB tests are skipped without a database)
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm test   # + DB tests
npm run build
```

The DB tests create and drop a temporary database on any PostgreSQL 15+ server, applying
`supabase/tests/supabase-shim.sql` (stand-ins for Supabase's `auth`/`storage` schemas), the
migrations and the seed. CI does the same with a Postgres service container.

## 6. Deploy (Vercel)

1. Import the repository in Vercel (framework preset: Next.js).
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_SITE_URL=https://<your-domain>`.
3. In Supabase, set the Site URL and add `https://<your-domain>/auth/confirm` to the redirect URLs.
4. For real e-mail volume, configure custom SMTP in Supabase (the built-in sender is rate-limited).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Yellow "demo mode" banner although Supabase is set up | Env vars missing or misspelt; restart `npm run dev` after editing `.env.local`. |
| Redirected to `/login` in a loop | Cookies blocked, or Site URL / redirect URLs not configured in Supabase. |
| `permission denied for column …` in custom queries | Intended: answer keys and explanations are not selectable. Use the `answer_qcm` / `submit_exam` RPCs, or the service role in admin tools. |
| Exam page shows "time is up" immediately | The server clock decides. Check the session's `expires_at`; the client corrects its own clock drift. |
| 3D viewer: "Could not load the 3D model" | Check the GLB URL (public bucket?), CORS, and that the file opens in https://gltf-viewer.donmccurdy.com. |
