#!/usr/bin/env bun

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Config,
  ConfigProvider,
  Console,
  Crypto,
  Effect,
  Encoding,
  FileSystem,
  Option,
  Path,
} from "effect";
import { PlatformError } from "effect/PlatformError";

type EnvMap = Record<string, string>;

interface FieldDefinition {
  readonly default?: string;
  readonly generate?: () => Effect.Effect<string, PlatformError, Crypto.Crypto>;
  readonly derive?: (ctx: EnvMap) => string;
}

const genPassword = Effect.fnUntraced(function* (length = 32) {
  const crypto = yield* Crypto.Crypto;
  return Encoding.encodeBase64Url(yield* crypto.randomBytes(length));
});

const fields: ReadonlyArray<readonly [string, FieldDefinition]> = [
  ["NODE_ENV", { default: "development" }],
  ["ROOT_DATABASE_USER", { default: "postgres" }],
  ["ROOT_DATABASE_PASSWORD", { default: "postgres" }],
  ["DATABASE_HOST", { default: "localhost" }],
  ["DATABASE_PORT", { default: "5433" }],
  ["DATABASE_NAME", { default: "nextjsblog" }],
  ["DATABASE_OWNER", { derive: (ctx) => ctx.DATABASE_NAME }],
  ["DATABASE_OWNER_PASSWORD", { generate: () => genPassword() }],
  ["DATABASE_AUTHENTICATOR", { derive: (ctx) => `${ctx.DATABASE_NAME}_authenticator` }],
  ["DATABASE_AUTHENTICATOR_PASSWORD", { generate: () => genPassword() }],
  ["DATABASE_VISITOR", { derive: (ctx) => `${ctx.DATABASE_NAME}_visitor` }],
  ["SHADOW_DATABASE_PASSWORD", { generate: () => genPassword() }],
  [
    "ROOT_DATABASE_URL",
    {
      derive: (ctx) =>
        `postgres://${ctx.ROOT_DATABASE_USER}:${ctx.ROOT_DATABASE_PASSWORD}@${ctx.DATABASE_HOST}:${ctx.DATABASE_PORT}/template1`,
    },
  ],
  [
    "DATABASE_URL",
    {
      derive: (ctx) =>
        `postgres://${ctx.DATABASE_OWNER}:${ctx.DATABASE_OWNER_PASSWORD}@${ctx.DATABASE_HOST}:${ctx.DATABASE_PORT}/${ctx.DATABASE_NAME}`,
    },
  ],
  [
    "AUTH_DATABASE_URL",
    {
      derive: (ctx) =>
        `postgres://${ctx.DATABASE_AUTHENTICATOR}:${ctx.DATABASE_AUTHENTICATOR_PASSWORD}@${ctx.DATABASE_HOST}:${ctx.DATABASE_PORT}/${ctx.DATABASE_NAME}`,
    },
  ],
  [
    "SHADOW_DATABASE_URL",
    {
      derive: (ctx) =>
        `postgres://${ctx.DATABASE_NAME}_shadow:${ctx.SHADOW_DATABASE_PASSWORD}@${ctx.DATABASE_HOST}:${ctx.DATABASE_PORT}/${ctx.DATABASE_NAME}_shadow`,
    },
  ],
  ["PORT", { default: "3000" }],
  ["VITE_ROOT_URL", { derive: (ctx) => `http://localhost:${ctx.PORT}` }],
  ["GITHUB_CLIENT_ID", { default: "" }],
  ["GITHUB_CLIENT_SECRET", { default: "" }],
];

const knownFieldConfigs: Record<string, Config.Config<Option.Option<string>>> = {};

for (const [key] of fields) {
  knownFieldConfigs[key] = Config.option(Config.string(key));
}

const knownFieldConfig = Config.all(knownFieldConfigs);
const knownKeys = new Set(fields.map(([key]) => key));

const extractExtras = (content: string): EnvMap => {
  const extras: EnvMap = {};

  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/u);

    if (match === null || knownKeys.has(match[1])) {
      continue;
    }

    extras[match[1]] = match[2];
  }

  return extras;
};

const resolveExistingValues = (parsed: Record<string, Option.Option<string>>): EnvMap => {
  const existing: EnvMap = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (Option.isSome(value)) {
      existing[key] = value.value;
    }
  }

  return existing;
};

const resolveField = (
  key: string,
  definition: FieldDefinition,
  existing: EnvMap,
  resolved: EnvMap,
) => {
  if (definition.derive) {
    return Effect.succeed(definition.derive(resolved));
  }

  if (Object.prototype.hasOwnProperty.call(existing, key)) {
    return Effect.succeed(existing[key]);
  }

  if (definition.generate) {
    return definition.generate();
  }

  return Effect.succeed(definition.default ?? "");
};

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dotenvPath = path.resolve(".env");
  const hasExistingEnvFile = yield* fs.exists(dotenvPath);
  const existingContent = hasExistingEnvFile ? yield* fs.readFileString(dotenvPath) : "";
  const parsedExisting = yield* knownFieldConfig.parse(
    ConfigProvider.fromDotEnvContents(existingContent),
  );
  const existing = resolveExistingValues(parsedExisting);
  const resolved: EnvMap = {};

  for (const [key, definition] of fields) {
    resolved[key] = yield* resolveField(key, definition, existing, resolved);
  }

  const merged = {
    ...resolved,
    ...extractExtras(existingContent),
  };

  const content = Object.entries(merged)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
    .concat("\n");

  yield* fs.writeFileString(dotenvPath, content);
  yield* Console.log(`${hasExistingEnvFile ? "Updated" : "Wrote"} .env`);
}).pipe(Effect.provide(NodeServices.layer));

NodeRuntime.runMain(main);
