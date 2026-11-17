/**
 * The API tests run against `<name>_test` on the same server as the development
 * databases, for both the app's pool (`AUTH_DATABASE_URL`) and the migration login
 * (`DATABASE_URL`), so no test reaches development data.
 */
export const testDatabaseEnv = (env: NodeJS.ProcessEnv) => {
  const { DATABASE_URL, AUTH_DATABASE_URL } = env;
  if (!DATABASE_URL || !AUTH_DATABASE_URL) {
    throw new Error("DATABASE_URL and AUTH_DATABASE_URL are required to derive the test databases");
  }
  return {
    DATABASE_URL: withTestSuffix(DATABASE_URL),
    AUTH_DATABASE_URL: withTestSuffix(AUTH_DATABASE_URL),
  };
};

/** The database name a connection string points at. */
export const databaseName = (connectionString: string): string =>
  new URL(connectionString).pathname.replace(/^\/+/, "");

/** Throws unless `name` is a test database. */
export const assertTestDatabaseName = (name: string): void => {
  if (!name.endsWith("_test")) {
    throw new Error(`refusing to run DB-backed tests against "${name}": not a _test database`);
  }
};

function withTestSuffix(connectionString: string): string {
  const url = new URL(connectionString);
  const name = databaseName(connectionString);
  if (!name) throw new Error("Connection string is missing a database name");
  url.pathname = `/${name}_test`;
  // docker publishes the port on IPv4 only, and Node may resolve localhost to ::1 first.
  if (url.hostname === "localhost" || url.hostname === "::1") url.hostname = "127.0.0.1";
  return url.toString();
}
