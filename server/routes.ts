import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { getCrossOriginHeaders } from "./cross-origin.js";
import { ApiLive } from "./discussion/api.js";

export function getRequestPathname(url: string): string {
  return decodeURIComponent(new URL(url, "http://localhost").pathname);
}

export const CrossOriginHeadersLive = HttpRouter.middleware(
  (effect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const response = yield* effect;
      const pathname = getRequestPathname(request.url);

      return HttpServerResponse.setHeaders(response, getCrossOriginHeaders(pathname));
    }),
  { global: true },
);

export const DiscussionNotFoundLive = HttpRouter.add(
  "*",
  "/api/*",
  Effect.succeed(HttpServerResponse.text("Not found", { status: 404 })),
);

/**
 * The discussion API as one router: the API, its 404 for unknown `/api` paths, and the
 * cross-origin headers on both. `server/dev.ts` serves it alone, and the API tests serve it
 * in process, so both see the same routes.
 */
export const DiscussionApiLive = Layer.mergeAll(ApiLive, DiscussionNotFoundLive).pipe(
  Layer.provide(CrossOriginHeadersLive),
);
