# dfg.codes

A React Router site with a comments-and-likes backend ("discussion"): an Effect
server on Postgres in `server/`, migrations in `migrations/`.

## Backend reference

The backend follows ~/build/effect-web-template. Before you add or change a
backend pattern (config, HTTP server, database access, errors, sessions, rate
limits, Valkey, realtime, worker, tests), read how the template does it and do
the same. Security code and auth SQL will come from `@danielfgray/stompbox`
(~/build/stompbox); this app does not depend on it yet.

When the template has no pattern for what you need, stop and ask the user
which way to go: prove the pattern in this app and then port it to the
template, or design it in effect-web-template first. Either way, file the
effect-web-template task, and add a `tasks blocks` edge from the task that
comes first to the one that follows.
