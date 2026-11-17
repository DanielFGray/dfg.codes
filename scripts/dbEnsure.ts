#!/usr/bin/env bun

import { PgClient } from "@effect/sql-pg";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Config,
  ConfigProvider,
  Console,
  Schema as S,
  Duration,
  Effect,
  FileSystem,
  Redacted,
  Schedule,
} from "effect";
import { SqlClient } from "effect/unstable/sql";
import { ChildProcess } from "effect/unstable/process";

class ScriptError extends S.TaggedErrorClass<ScriptError>()("ScriptError", {
  message: S.String,
}) {}

interface DbTestOptions {
  readonly minDelay?: number;
  readonly maxTries?: number;
  readonly maxDelay?: number;
}

const databaseLayer = (url: string) =>
  PgClient.layer({
    url: Redacted.make(url),
    connectTimeout: Duration.seconds(3),
    maxConnections: 1,
    applicationName: "dfg.codes dbEnsure",
  });

export function dbTest(
  url: string,
  { minDelay = 50, maxTries = Infinity, maxDelay = 30_000 }: DbTestOptions = {},
) {
  const performTest = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`select 1`;
    return true as const;
  }).pipe(Effect.provide(databaseLayer(url)));

  const retryScheduleBase = Schedule.exponential(Duration.millis(minDelay), 1.8).pipe(
    Schedule.modifyDelay((_, delay) =>
      Effect.succeed(Duration.min(delay, Duration.millis(maxDelay))),
    ),
  );

  const retrySchedule = Number.isFinite(maxTries)
    ? retryScheduleBase.pipe(Schedule.take(maxTries))
    : retryScheduleBase;

  return performTest.pipe(
    Effect.tapErrorTag("SqlError", (error) =>
      Console.warn(`Database is not ready yet: ${error.message}`),
    ),
    Effect.retry({
      schedule: retrySchedule,
      while: (error) => error.isRetryable,
    }),
  );
}

const runScript = Effect.fnUntraced(function* (name: string) {
  const handle = yield* ChildProcess.make("bun", ["run", name], {
    cwd: ".",
    extendEnv: true,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = yield* handle.exitCode;

  if (exitCode !== 0) {
    yield* Effect.fail(
      new ScriptError({
        message: `${name}: exited with code ${exitCode}`,
      }),
    );
  }
}, Effect.scoped);

// `ops dev db up` writes DATABASE_URL to .env, so this process's environment is stale
// until it is read again. A missing key throws and exits non-zero.
const readDatabaseUrl = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(".env");
  return yield* Config.string("DATABASE_URL").parse(ConfigProvider.fromDotEnvContents(content));
});

// `ops dev db up` provisions the shared dev databases. This script never drops one to
// recover: a failed connect check stops it with the error.
const main = Effect.gen(function* () {
  yield* runScript("db:up");
  yield* dbTest(yield* readDatabaseUrl, { maxTries: 7 });
  yield* Console.log("Database is ready");
}).pipe(Effect.provide(NodeServices.layer));

NodeRuntime.runMain(main);
