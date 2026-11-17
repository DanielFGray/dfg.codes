// @entrypoint: vitest runs this in each API test file before its imports, so the app's
// pools are created on the test databases.
import { assertTestDatabaseName, databaseName, testDatabaseEnv } from "./testDatabase.js";

const testEnv = testDatabaseEnv(process.env);
for (const url of [testEnv.DATABASE_URL, testEnv.AUTH_DATABASE_URL]) {
  assertTestDatabaseName(databaseName(url));
}
Object.assign(process.env, testEnv);
