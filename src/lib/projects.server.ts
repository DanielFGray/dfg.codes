import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";

import { ProjectsApi } from "#src/services/projects-api.js";
import type { Project } from "#src/services/projects.js";

/**
 * The project list, read from the projects API (`/api/projects`) at `origin`. The API
 * holds the cached GitHub data, so a page render costs no GitHub request of its own.
 * Resolves to null when the API cannot answer: the page then says so instead of failing.
 */
export function fetchProjects(origin: string): Promise<readonly Project[] | null> {
  return HttpApiClient.make(ProjectsApi, { baseUrl: origin }).pipe(
    Effect.flatMap((client) => client.getProjects()),
    // The router serialises loader data, which a schema class instance would not survive.
    Effect.map((list) => list.map((project) => ({ ...project }))),
    Effect.catch((error) =>
      Effect.logWarning("project list unavailable", error).pipe(Effect.as(null)),
    ),
    Effect.provide(FetchHttpClient.layer),
    Effect.runPromise,
  );
}
