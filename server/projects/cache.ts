import { Cache, Duration, Effect, Exit, Layer } from "effect";

import { ProjectsCache } from "../../src/services/projects.js";
import { fetchRepos } from "./github.js";

/**
 * The singleton cache. `get` is a pull-through Effect `Cache`: the first
 * caller triggers the fetch, callers that arrive mid-fetch share the one
 * in-progress lookup, and the entry is reused until its TTL expires. A
 * successful fetch lives 30 minutes; a failed one lives 30 seconds, so a
 * GitHub outage or rate limit is retried shortly instead of poisoning the
 * cache for the full window.
 *
 * No `Schedule` loop is needed: the cache refreshes lazily on the next request
 * after TTL, so a quiet server makes no requests at all.
 */
export const ProjectsCacheLive = Layer.effect(
  ProjectsCache,
  Effect.gen(function* () {
    const cache = yield* Cache.makeWith(
      () => fetchRepos,
      {
        capacity: 1,
        timeToLive: (exit) =>
          Exit.isFailure(exit) ? Duration.seconds(30) : Duration.minutes(30),
      },
    );

    return {
      get: Cache.get(cache, "repos"),
      refresh: Cache.refresh(cache, "repos").pipe(Effect.asVoid),
    };
  }),
);
