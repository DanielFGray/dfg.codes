import { expect, it } from "@effect/vitest";
import pg from "pg";
import { Effect } from "effect";

// Catalog checks over every function the app's owner defines. The stompbox checker is not
// part of `bun run test`, so these keep the grants and search paths from regressing.
const APP_FUNCTIONS_FROM = `
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'auth', 'hidden')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
`;

/** Runs `use` on a fresh connection to the test database, then closes it. */
const withClient = <A>(use: (client: pg.Client) => Promise<A>) =>
  Effect.acquireUseRelease(
    Effect.promise(async () => {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      return client;
    }),
    (client) => Effect.promise(() => use(client)),
    (client) => Effect.promise(() => client.end()),
  );

it.effect("a function the owner creates is not executable by PUBLIC", () =>
  withClient(async (client) => {
    await client.query("begin");
    try {
      await client.query(
        "create function public.probe_default_privileges() returns integer language sql as 'select 1'",
      );
      const { rows } = await client.query<{ executable: boolean }>(
        "select has_function_privilege('public', 'public.probe_default_privileges()', 'execute') as executable",
      );
      return rows;
    } finally {
      await client.query("rollback");
    }
  }).pipe(Effect.map((rows) => expect(rows).toEqual([{ executable: false }]))),
);

it.effect("no app function is executable by PUBLIC", () =>
  withClient(async (client) => {
    const { rows } = await client.query<{ fn: string }>(
      `select p.oid::regprocedure::text as fn ${APP_FUNCTIONS_FROM}
         and has_function_privilege('public', p.oid, 'execute')
       order by fn`,
    );
    return rows;
  }).pipe(Effect.map((rows) => expect(rows).toEqual([]))),
);

it.effect("every security definer function ends its search_path with pg_temp", () =>
  withClient(async (client) => {
    const { rows } = await client.query<{ fn: string }>(
      `select p.oid::regprocedure::text as fn ${APP_FUNCTIONS_FROM}
         and p.prosecdef
         and not exists (
           select 1 from unnest(coalesce(p.proconfig, '{}')) setting
           where setting ~ '^search_path=.*pg_temp$'
         )
       order by fn`,
    );
    return rows;
  }).pipe(Effect.map((rows) => expect(rows).toEqual([]))),
);
