// @entrypoint: vitest calls setup() once before the API tests run.
import { spawnSync } from "node:child_process";

import { assertTestDatabaseName, databaseName, testDatabaseEnv } from "./testDatabase.js";

/**
 * Migrates the `_test` database once per run. `ops dev db test` resets it before this
 * runs, while holding the app's test-database lock.
 */
export default function setup(): void {
  const testEnv = testDatabaseEnv(process.env);
  assertTestDatabaseName(databaseName(testEnv.DATABASE_URL));
  run("bun", ["-b", "graphile-migrate", "watch", "--once"], { ...process.env, ...testEnv });
}

function run(command: string, args: ReadonlyArray<string>, env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${[command, ...args].join(" ")} exited with status ${result.status}`);
  }
}
