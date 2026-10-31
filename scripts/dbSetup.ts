#!/usr/bin/env bun

import { Config, Console, Duration, Effect, Queue, Redacted, Schedule, Terminal } from "effect";
import { PgClient } from "@effect/sql-pg";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { SqlClient } from "effect/unstable/sql";

const sqlStringLiteral = (value: string) => `'${value.split("'").join("''")}'`;

const main = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;

  const rootDatabaseUrl = yield* Config.redacted("ROOT_DATABASE_URL");
  const databaseName = yield* Config.string("DATABASE_NAME");
  const databaseOwner = yield* Config.string("DATABASE_OWNER");
  const databaseOwnerPassword = yield* Config.redacted("DATABASE_OWNER_PASSWORD");
  const databaseAuthenticator = yield* Config.string("DATABASE_AUTHENTICATOR");
  const databaseAuthenticatorPassword = yield* Config.redacted("DATABASE_AUTHENTICATOR_PASSWORD");
  const databaseVisitor = yield* Config.string("DATABASE_VISITOR");
  const shadowDatabasePassword = yield* Config.redacted("SHADOW_DATABASE_PASSWORD");

  const rootLayer = PgClient.layer({
    url: rootDatabaseUrl,
    connectTimeout: Duration.seconds(5),
    maxConnections: 1,
    applicationName: "dfg.codes dbSetup",
  });

  yield* Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select 1`).pipe(
    Effect.provide(rootLayer),
    Effect.tapErrorTag("SqlError", (error) =>
      Console.warn(`Database is not ready yet: ${error.message}`),
    ),
    Effect.retry({
      schedule: Schedule.exponential(Duration.millis(200), 1.8).pipe(
        Schedule.modifyDelay((_, delay) =>
          Effect.succeed(Duration.min(delay, Duration.seconds(30))),
        ),
        Schedule.take(20),
      ),
      while: (error) =>
        error.reason._tag === "ConnectionError" || error.reason._tag === "UnknownError",
    }),
  );

  yield* Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const shadowRole = `${databaseName}_shadow`;
    const databases = [databaseName, `${databaseName}_shadow`, `${databaseName}_test`];
    const roles = [databaseOwner, databaseAuthenticator, databaseVisitor, shadowRole];

    if (!(yield* Config.withDefault(false)(Config.string("NOCONFIRM")))) {
      yield* Console.log(
        "This will drop and recreate the database. Are you sure you want to continue? (y/N) ",
      );
      const [answer] = yield* Queue.takeN(yield* terminal.readInput, 1);
      if (answer.input.valueOrUndefined !== "y") return;
    }

    yield* Effect.forEach(
      databases,
      (database) => sql`drop database if exists ${sql(database)}`.unprepared,
    );

    yield* Effect.forEach(roles, (role) => sql`drop role if exists ${sql(role)}`.unprepared);

    yield* sql`create role ${sql(databaseOwner)} login password ${sql.literal(sqlStringLiteral(Redacted.value(databaseOwnerPassword)))}`
      .unprepared;
    yield* Console.info(`CREATE ROLE ${databaseOwner}`);

    yield* sql`create role ${sql(databaseAuthenticator)} login password ${sql.literal(sqlStringLiteral(Redacted.value(databaseAuthenticatorPassword)))} noinherit`
      .unprepared;
    yield* Console.info(`CREATE ROLE ${databaseAuthenticator}`);

    yield* sql`create role ${sql(databaseVisitor)}`.unprepared;
    yield* Console.info(`CREATE ROLE ${databaseVisitor}`);

    yield* sql`create role ${sql(shadowRole)} login password ${sql.literal(sqlStringLiteral(Redacted.value(shadowDatabasePassword)))} superuser`
      .unprepared;
    yield* Console.info(`CREATE ROLE ${shadowRole}`);

    yield* sql`grant ${sql(databaseVisitor)} to ${sql(databaseAuthenticator)}`.unprepared;
    yield* Console.info(`GRANT ${databaseVisitor} TO ${databaseAuthenticator}`);

    yield* sql`create database ${sql(databaseName)} owner ${sql(databaseOwner)}`.unprepared;
    yield* Console.info(`CREATE DATABASE ${databaseName}`);

    yield* sql`create database ${sql(`${databaseName}_shadow`)} owner ${sql(shadowRole)}`
      .unprepared;
    yield* Console.info(`CREATE DATABASE ${`${databaseName}_shadow`}`);

    yield* sql`create database ${sql(`${databaseName}_test`)} owner ${sql(databaseOwner)}`
      .unprepared;
    yield* Console.info(`CREATE DATABASE ${`${databaseName}_test`}`);
  }).pipe(Effect.provide(rootLayer), Effect.catch(Console.error));
}).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

NodeRuntime.runMain(main);
