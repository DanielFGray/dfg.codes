// @effect-diagnostics-next-line nodeBuiltinImport:off -- NodeHttpServer.layer takes a node:http server factory
import { createServer } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, Ref } from "effect";
import { Cookies, FetchHttpClient, HttpClient, HttpRouter, HttpServer } from "effect/http";

import { connectedDatabaseName } from "../db.js";
import { DiscussionApiLive } from "../routes.js";
import { assertTestDatabaseName } from "./testDatabase.js";

/**
 * A server on a free port of 127.0.0.1, and an `HttpClient` aimed at it. The client
 * returns a redirect as it is, so a test asserts on the 3xx itself.
 */
const TestServer = HttpServer.layerTestClient.pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit)({ keepalive: false, redirect: "manual" }),
  ),
  Layer.provideMerge(NodeHttpServer.layer(createServer, { port: 0, host: "127.0.0.1" })),
);

/** The discussion API served on `TestServer`, with paths such as `/api/session`. */
const Served = HttpRouter.serve(DiscussionApiLive, {
  disableLogger: true,
  disableListenLog: true,
}).pipe(Layer.provideMerge(TestServer));

/**
 * Fails the suite unless the API's own pool is connected to a `_test` database. The
 * name comes from the pool that serves the requests, not from the URL in the environment.
 */
const ConnectsToTestDatabase = Layer.effectDiscard(
  connectedDatabaseName.pipe(
    Effect.flatMap((name) => Effect.sync(() => assertTestDatabaseName(name))),
  ),
);

export const TestApi = Layer.merge(Served, ConnectsToTestDatabase);

/**
 * A session with its own cookie jar: the `Set-Cookie` of a response is sent on this
 * session's later requests, and no other session sees it.
 */
export const newSession = Effect.gen(function* () {
  const jar = yield* Ref.make<ReadonlyArray<Cookies.Cookie>>([]);
  const http = (yield* HttpClient.HttpClient).pipe(HttpClient.withCookiesRef(jar));
  return http;
});

/** The origin the test server listens on, such as `http://127.0.0.1:41234`. */
export const serverOrigin = HttpServer.addressFormattedWith((origin) => Effect.succeed(origin));
