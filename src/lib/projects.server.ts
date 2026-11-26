import { Effect, ManagedRuntime } from "effect";

import { mergeProjects } from "../../server/projects/merge.js";
import { ProjectsCacheLive } from "../../server/projects/cache.js";
import { ProjectsCache, type Project } from "#src/services/projects.js";

// One runtime for the page server process, so the GitHub cache is created once and
// shared by every request.
const runtime = ManagedRuntime.make(ProjectsCacheLive);

/**
 * The project list: the registry merged with the cached GitHub data. Resolves to null
 * when GitHub could not answer, so the page can say so instead of failing.
 */
export function loadProjects(): Promise<readonly Project[] | null> {
  return ProjectsCache.pipe(
    Effect.flatMap((cache) => cache.get),
    // The router serialises loader data, which a schema class instance would not survive.
    Effect.map((repos) => mergeProjects(repos).map((project) => ({ ...project }))),
    Effect.catch((error) =>
      Effect.logWarning("project list unavailable", error).pipe(Effect.as(null)),
    ),
    runtime.runPromise,
  );
}
