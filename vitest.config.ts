import { defineConfig } from "vitest/config";

// Every test file that reads the database. The `unit` project excludes them, so
// `test:unit` runs with no database. The `unit` project also picks up unit tests
// colocated with the app code.
const API_TESTS = [
  "server/test/database-privileges.test.ts",
  "server/test/discussion-api.test.ts",
];

export default defineConfig({
  test: {
    testTimeout: 60_000,
    projects: [
      {
        test: {
          name: "unit",
          include: ["server/test/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
          exclude: [...API_TESTS, "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        // `ops dev db test` holds the app's test-database lock around this project, so
        // runs take turns.
        test: {
          name: "api",
          include: API_TESTS,
          environment: "node",
          // The API tests share one database and one client IP, and registration is
          // rate-limited per IP: files running at once would spend each other's attempts.
          fileParallelism: false,
          // Runs in each test file before its imports, so the app's pools use the test databases.
          setupFiles: ["./server/test/setup.ts"],
          globalSetup: ["./server/test/globalSetup.ts"],
        },
      },
    ],
  },
});
