import { NodeHttpPlatform, NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { createServer } from "node:http";
import { Config, Effect, Layer, Logger } from "effect";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { getCrossOriginHeaders } from "./cross-origin.js";
import { ApiLive } from "./discussion/api.js";

function getRequestPathname(url: string): string {
  return decodeURIComponent(new URL(url, "http://localhost").pathname);
}

const CrossOriginHeadersLive = HttpRouter.middleware(
  (effect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const response = yield* effect;
      const pathname = getRequestPathname(request.url);

      return HttpServerResponse.setHeaders(response, getCrossOriginHeaders(pathname));
    }),
  { global: true },
);

const DiscussionNotFoundLive = HttpRouter.add(
  "*",
  "/api/*",
  Effect.succeed(HttpServerResponse.text("Not found", { status: 404 })),
);

const app = Layer.mergeAll(ApiLive, DiscussionNotFoundLive).pipe(
  Layer.provide(CrossOriginHeadersLive),
);

const runtimeLayer = Layer.mergeAll(
  Logger.layer([Logger.consolePretty()]),
  NodeHttpPlatform.layer,
  NodeHttpServer.layerConfig(
    createServer,
    Config.all({
      host: Config.withDefault(Config.string("DISCUSSION_API_HOST"), "127.0.0.1"),
      port: Config.withDefault(Config.port("DISCUSSION_API_PORT"), 3001),
    }),
  ),
);

const serverLayer = HttpRouter.serve(app);

NodeRuntime.runMain(Layer.launch(serverLayer).pipe(Effect.provide(runtimeLayer)));
