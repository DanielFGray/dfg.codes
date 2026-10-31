import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  webServer: {
    command: "HOST=127.0.0.1 PORT=4173 bun run-s db:latest start",
    url: "http://127.0.0.1:4173/api/session",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
