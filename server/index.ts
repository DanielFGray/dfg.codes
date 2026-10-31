import {
  NodeFileSystem,
  NodeHttpPlatform,
  NodeHttpServer,
  NodePath,
  NodeRuntime,
} from "@effect/platform-node";
import { createServer } from "node:http";
import { createRequestHandler, type RequestHandler, type ServerBuild } from "react-router";
import { Config, Context, Effect, FileSystem, Layer, Logger, Option, Path } from "effect";
import {
  Etag,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { getCrossOriginHeaders } from "./cross-origin.js";
import { ApiLive } from "./discussion/api.js";

type RuntimePaths = {
  clientBuildDirectory: string;
  serverBuildUrl: URL;
};

const RuntimePaths = Context.Service<RuntimePaths>("dfg/RuntimePaths");

const RuntimePathsLive = Layer.effect(
  RuntimePaths,
  Effect.fnUntraced(function* () {
    const path = yield* Path.Path;
    const runtimeDirectory = yield* path.fromFileUrl(new URL(".", import.meta.url));
    // This file runs from source (`bun server/index.ts`), so dist/ is its sibling.
    const distDirectory = path.resolve(runtimeDirectory, "../dist");

    return {
      clientBuildDirectory: path.resolve(distDirectory, "client"),
      serverBuildUrl: yield* path.toFileUrl(path.resolve(distDirectory, "server/index.js")),
    } satisfies RuntimePaths;
  })(),
);

const ReactRouterRequestHandler = Context.Service<RequestHandler>("dfg/ReactRouterRequestHandler");

const ReactRouterRequestHandlerLive = Layer.effect(
  ReactRouterRequestHandler,
  Effect.fnUntraced(function* () {
    const { serverBuildUrl } = yield* RuntimePaths;
    const mode = yield* Config.literals(["development", "production", "test"], "NODE_ENV").pipe(
      Config.withDefault("production"),
    );
    const build = yield* Effect.tryPromise({
      try: () => import(serverBuildUrl.href) as Promise<ServerBuild>,
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });

    return createRequestHandler(build, mode);
  })(),
);

function getRequestPathname(url: string): string {
  return decodeURIComponent(new URL(url, "http://localhost").pathname);
}

const resolveStaticAssetPath = Effect.fnUntraced(function* (pathname: string) {
  if (pathname === "/") {
    return Option.none<string>();
  }

  const { clientBuildDirectory } = yield* RuntimePaths;
  const path = yield* Path.Path;
  const relativePath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const assetPath = path.resolve(clientBuildDirectory, relativePath);

  if (
    assetPath === clientBuildDirectory ||
    assetPath.startsWith(`${clientBuildDirectory}${path.sep}`)
  ) {
    return Option.some(assetPath);
  }

  return Option.none<string>();
});

const maybeServeStaticAsset = Effect.fnUntraced(function* (pathname: string) {
  const assetPath = yield* resolveStaticAssetPath(pathname);

  if (Option.isNone(assetPath)) {
    return Option.none<HttpServerResponse.HttpServerResponse>();
  }

  const fileSystem = yield* FileSystem.FileSystem;
  const exists = yield* fileSystem.exists(assetPath.value);

  if (!exists) {
    return Option.none<HttpServerResponse.HttpServerResponse>();
  }

  const fileInfo = yield* fileSystem.stat(assetPath.value);

  if (fileInfo.type !== "File") {
    return Option.none<HttpServerResponse.HttpServerResponse>();
  }

  let response = yield* HttpServerResponse.file(assetPath.value);

  if (pathname.startsWith("/assets/")) {
    response = HttpServerResponse.setHeader(
      response,
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  }

  return Option.some(response);
});

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

const ReactAppLive = HttpRouter.add(
  "*",
  "*",
  Effect.fnUntraced(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const pathname = getRequestPathname(request.url);
    const staticAsset = yield* maybeServeStaticAsset(pathname);

    if (Option.isSome(staticAsset)) {
      return staticAsset.value;
    }

    const requestHandler = yield* ReactRouterRequestHandler;
    const webRequest = yield* HttpServerRequest.toWeb(request);
    const webResponse = yield* Effect.tryPromise({
      try: () => requestHandler(webRequest),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });

    return HttpServerResponse.fromWeb(webResponse);
  })(),
);

const app = Layer.mergeAll(ApiLive, DiscussionNotFoundLive, ReactAppLive).pipe(
  Layer.provide(CrossOriginHeadersLive),
);

const runtimePathsLayer = RuntimePathsLive.pipe(Layer.provide(NodePath.layer));
const reactRouterRequestHandlerLayer = ReactRouterRequestHandlerLive.pipe(
  Layer.provide(runtimePathsLayer),
);

const runtimeLayer = Layer.mergeAll(
  Logger.layer([Logger.consolePretty()]),
  NodeFileSystem.layer,
  NodeHttpPlatform.layer,
  NodePath.layer,
  Etag.layer,
  runtimePathsLayer,
  reactRouterRequestHandlerLayer,
  NodeHttpServer.layerConfig(
    createServer,
    Config.all({
      host: Config.withDefault(Config.string("HOST"), "0.0.0.0"),
      port: Config.withDefault(Config.port("PORT"), 3000),
    }),
  ),
);

const serverLayer = HttpRouter.serve(app);

NodeRuntime.runMain(Layer.launch(serverLayer).pipe(Effect.provide(runtimeLayer)));
