import { type DatabaseError, db, toDatabaseError } from "@danielfgray/stompbox/db";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, Option, Schema } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import { SqlClient } from "effect/sql/SqlClient";
import { sql } from "kysely";

import type { DB } from "../generated/DB.js";
import type { RequestContextValue } from "./discussion/request-context.js";

/**
 * The API's own pool, as the `SqlClient`. The login does not inherit the visitor role's
 * rights, so every query runs in a transaction that switches to it: see `withVisitorRole`.
 */
export const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("AUTH_DATABASE_URL") });

/** Queries typed by the generated tables, run on the transaction `withVisitorRole` opens. */
export const query = db<DB>();

const visitorRole = Config.String("DATABASE_VISITOR").pipe(Config.withDefault("visitor"));

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

/** Runs `effect` as the visitor role, with the request's headers, address and session for RLS. */
export const withAuthContext = <A, E, R>(
  context: RequestContextValue,
  effect: Effect.Effect<A, E, R>,
) =>
  withVisitorRole(effect, {
    "dfgcodes.headers": requestHeadersJson(context),
    "dfgcodes.ip_address": requestIpAddress(context),
    "dfgcodes.session_id": requestSessionId(context),
  });

/**
 * Runs `effect` in one transaction that switches to the visitor role and sets `settings` until
 * it ends. Signing in and finding a session run before a request has a session, so they pass
 * none. A failure of the transaction itself (begin, commit) arrives as a `DatabaseError` too.
 */
export const withVisitorRole = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  settings: Readonly<Record<string, string>> = {},
): Effect.Effect<A, Exclude<E, SqlError> | DatabaseError, R | SqlClient> =>
  Effect.gen(function* () {
    const client = yield* SqlClient;
    const role = yield* visitorRole.pipe(Effect.orDie);
    const configs = Object.entries({ role, ...settings });
    const applySettings = query.exec((k) =>
      k.selectNoFrom(
        configs.map(([name, value], index) =>
          sql<string>`set_config(${name}, ${value}, true)`.as(`setting_${index}`),
        ),
      ),
    );
    return yield* client.withTransaction(Effect.andThen(applySettings, effect));
  }).pipe(toDatabaseError);

/**
 * The database the API's own pool is connected to. The API tests read it to refuse a run
 * against a development database, since the pool, not the URL in the environment, is what
 * the requests use.
 */
export const connectedDatabaseName = withVisitorRole(
  query.one(Schema.Struct({ name: Schema.String }), (k) =>
    k.selectNoFrom(sql<string>`current_database()`.as("name")),
  ),
).pipe(Effect.map(({ name }) => name));
