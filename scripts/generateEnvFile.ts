#!/usr/bin/env bun

// Writes the app's own settings to .env. The database URLs and roles are not here: `ops dev
// db up` provisions the dev databases and writes them (see db:ensure), and a value written
// here would be overwritten by it.
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, ConfigProvider, Console, Effect, FileSystem, Option, Path } from "effect";

const fields: ReadonlyArray<readonly [string, string]> = [
  ["NODE_ENV", "development"],
  ["PORT", "3000"],
  ["VITE_ROOT_URL", "http://localhost:3000"],
  ["GITHUB_CLIENT_ID", ""],
  ["GITHUB_CLIENT_SECRET", ""],
];

const knownKeys = new Set(fields.map(([key]) => key));

// Keys this script does not own, such as ops-written database URLs, survive an update.
const extractExtras = (content: string): Record<string, string> => {
  const extras: Record<string, string> = {};
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/u);
    if (match === null || knownKeys.has(match[1])) continue;
    extras[match[1]] = match[2];
  }
  return extras;
};

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dotenvPath = path.resolve(".env");
  const hasExistingEnvFile = yield* fs.exists(dotenvPath);
  const existingContent = hasExistingEnvFile ? yield* fs.readFileString(dotenvPath) : "";
  const existing = yield* Config.all(
    Object.fromEntries(fields.map(([key]) => [key, Config.option(Config.string(key))])),
  ).parse(ConfigProvider.fromDotEnvContents(existingContent));

  const resolved = Object.fromEntries(
    fields.map(([key, fallback]) => [key, Option.getOrElse(existing[key], () => fallback)]),
  );
  const merged = { ...resolved, ...extractExtras(existingContent) };

  const content = Object.entries(merged)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
    .concat("\n");

  yield* fs.writeFileString(dotenvPath, content);
  yield* Console.log(`${hasExistingEnvFile ? "Updated" : "Wrote"} .env`);
}).pipe(Effect.provide(NodeServices.layer));

NodeRuntime.runMain(main);
