import { NodeHttpPlatform, NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { createServer } from "node:http";
import { Config, Effect, Layer, Logger } from "effect";
import { HttpRouter } from "effect/http";

import { DatabaseLive } from "./db.js";
import { DiscussionApiLive } from "./routes.js";

const runtimeLayer = Layer.mergeAll(
  Logger.layer([Logger.consolePretty()]),
  NodeHttpPlatform.layer,
  NodeHttpServer.layerConfig(
    createServer,
    Config.all({
      host: Config.withDefault(Config.String("DISCUSSION_API_HOST"), "127.0.0.1"),
      port: Config.withDefault(Config.Port("DISCUSSION_API_PORT"), 3001),
    }),
  ),
);

const serverLayer = HttpRouter.serve(DiscussionApiLive).pipe(Layer.provide(DatabaseLive));

NodeRuntime.runMain(Layer.launch(serverLayer).pipe(Effect.provide(runtimeLayer)));
