import { Array as A, Effect, Exit, Option, Schema } from "effect";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";

import type { DB } from "../generated/DB.js";
import type { RequestContextValue } from "./discussion/request-context.js";

pg.types.setTypeParser(20, (value: string) => Number(value));

if (!process.env.AUTH_DATABASE_URL) {
  throw new Error("AUTH_DATABASE_URL must be set to use the local Postgres discussion services");
}

const authPool = new pg.Pool({
  connectionString: process.env.AUTH_DATABASE_URL,
});

// The login does not inherit the visitor role's rights, so every query runs in a transaction
// that switches to it: see withVisitorRole.
const authDb = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: authPool }),
});

export type DiscussionTransaction = Transaction<DB>;

export class SqlError extends Schema.TaggedError<SqlError>()("SqlError", {
  cause: Schema.Unknown,
  message: Schema.String,
}) {}

type ExecutableQuery<A> = {
  readonly compile: () => { readonly sql: string };
  readonly execute: () => Promise<A>;
};

const executeQueryError = (cause: unknown) =>
  cause instanceof SqlError
    ? cause
    : new SqlError({ cause, message: "Unable to execute discussion query" });

export const executeQuery = <A>(query: ExecutableQuery<A>): Effect.Effect<A, SqlError> =>
  Effect.tryPromise({
    try: () => query.execute(),
    catch: executeQueryError,
  }).pipe(
    Effect.withSpan("kysely.execute", {
      kind: "client",
      attributes: {
        "db.query.text": query.compile().sql,
      },
    }),
  );

export const executeTakeFirst = <A>(
  query: ExecutableQuery<ReadonlyArray<A>>,
): Effect.Effect<Option.Option<A>, SqlError> => executeQuery(query).pipe(Effect.map(A.head));

const visitorRole = process.env.DATABASE_VISITOR ?? "visitor";

const requestHeadersJson = (context: RequestContextValue) => JSON.stringify(context.headers);

const requestIpAddress = (context: RequestContextValue) =>
  context.headers["cf-connecting-ip"] ??
  context.headers["x-real-ip"] ??
  context.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  "127.0.0.1";

const requestSessionId = (context: RequestContextValue) =>
  Option.match(context.sessionCookieId, {
    onNone: () => "",
    onSome: (sessionCookieId) => sessionCookieId,
  });

/** Runs `fn` as the visitor role, with the request's headers, address and session for RLS. */
export const withAuthContext = <A, E>(
  context: RequestContextValue,
  fn: (db: DiscussionTransaction) => Effect.Effect<A, E, never>,
): Effect.Effect<A, E | SqlError> =>
  withVisitorRole(fn, {
    "dfgcodes.headers": requestHeadersJson(context),
    "dfgcodes.ip_address": requestIpAddress(context),
    "dfgcodes.session_id": requestSessionId(context),
  });

/**
 * Runs `fn` in a transaction that switches to the visitor role and sets `settings` until it
 * ends. Signing in and finding a session run before a request has a session, so they pass none.
 */
export function withVisitorRole<A, E>(
  fn: (db: DiscussionTransaction) => Effect.Effect<A, E, never>,
  settings: Readonly<Record<string, string>> = {},
): Effect.Effect<A, E | SqlError> {
  const configs = Object.entries({ role: visitorRole, ...settings }).map(
    ([name, value]) => sql`set_config(${name}, ${value}, true)`,
  );

  return Effect.callback<A, E | SqlError>((resume) => {
    void authDb
      .transaction()
      .execute(async (trx) => {
        await sql`select ${sql.join(configs)}`.execute(trx);

        const exit = await Effect.runPromiseExit(fn(trx));
        if (Exit.isSuccess(exit)) {
          return exit.value;
        }

        throw exit;
      })
      .then(
        (value) => resume(Effect.succeed(value)),
        (cause) => {
          if (Exit.isExit(cause)) {
            const exit = cause as Exit.Exit<A, E | SqlError>;

            resume(
              Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause),
            );
            return;
          }

          resume(Effect.fail(cause instanceof SqlError ? cause : executeQueryError(cause)));
        },
      );
  });
}

/**
 * The database the API's own pool is connected to. The API tests read it to refuse a run
 * against a development database, since the pool, not the URL in the environment, is what
 * the requests use.
 */
export const connectedDatabaseName = withVisitorRole((db) =>
  executeQuery(db.selectNoFrom(sql<string>`current_database()`.as("name"))).pipe(
    Effect.map((rows) => rows[0]?.name ?? ""),
  ),
);
