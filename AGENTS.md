# dfg.codes

A React Router site with a comments-and-likes backend ("discussion"): an Effect
server on Postgres in `server/`, migrations in `migrations/`.

## Setup and database

- A new checkout (a `git worktree add`, a fresh clone): `bun run setup`. It
  installs, writes `.env`, runs `ops dev db up` and migrates. It never resets a
  database.
- The dev databases are shared on the ops cluster: `dfg_codes_dev` with
  `_shadow` and `_test`. `ops dev db up` (`bun run db:up`) provisions them and
  writes their URLs to `.env`; `bun run db:exec` opens psql.
- `bun run db:latest` migrates. `bun run db:reset` erases the schema of
  `dfg_codes_dev` (it is not a database drop), so run it only on purpose.
- Never run `ops dev db drop` or `ops dev db reset` on `dfg_codes_dev` from agent
  work. `bun run test:api` resets only the `_test` databases.

## Backend reference

The backend follows ~/build/effect-web-template. Before you add or change a
backend pattern (config, HTTP server, database access, errors, sessions, rate
limits, Valkey, realtime, worker, tests), read how the template does it and do
the same. The app depends on `@danielfgray/stompbox` (v0.2.0, ~/build/stompbox) for
queries (`/db`) and HTTP failure handling (`/http`, `/http/server`, `/http/client`): use
those, not copies of the template's files.

When the template has no pattern for what you need, stop and ask the user
which way to go: prove the pattern in this app and then port it to the
template, or design it in effect-web-template first. Either way, file the
effect-web-template task, and add a `tasks blocks` edge from the task that
comes first to the one that follows.
