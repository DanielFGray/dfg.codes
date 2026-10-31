import { Array as A, Effect, Exit, Option, Schema } from "effect";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";

import type { DB } from "../generated/DB.js";
import type { RequestContextValue } from "./discussion/request-context.js";

pg.types.setTypeParser(20, (value: string) => Number(value));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to use the local Postgres discussion services");
}

if (!process.env.AUTH_DATABASE_URL) {
  throw new Error("AUTH_DATABASE_URL must be set to use the local Postgres discussion services");
}

const rootPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const authPool = new pg.Pool({
  connectionString: process.env.AUTH_DATABASE_URL,
});

export const rootDb = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: rootPool }),
});

export const authDb = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: authPool }),
});

export type DiscussionDatabase = typeof rootDb;
export type DiscussionTransaction = Transaction<DB>;

export class SqlError extends Schema.TaggedErrorClass<SqlError>()("SqlError", {
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

export function withAuthContext<A, E>(
  context: RequestContextValue,
  fn: (db: DiscussionTransaction) => Effect.Effect<A, E, never>,
): Effect.Effect<A, E | SqlError> {
  return Effect.callback<A, E | SqlError>((resume) => {
    void authDb
      .transaction()
      .execute(async (trx) => {
        await sql`
        select
          set_config('role', ${visitorRole}, true),
          set_config('dfgcodes.headers', ${requestHeadersJson(context)}, true),
          set_config('dfgcodes.ip_address', ${requestIpAddress(context)}, true),
          set_config('dfgcodes.session_id', ${requestSessionId(context)}, true)
      `.execute(trx);

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
