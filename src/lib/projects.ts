import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";

import { ProjectsApi } from "#src/services/projects-api.js";

const canQuery = typeof window !== "undefined";

const client = Effect.runSync(
  HttpApiClient.make(ProjectsApi, {
    baseUrl: canQuery ? window.location.origin : undefined,
  }).pipe(Effect.provide(FetchHttpClient.layer)),
);

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    enabled: canQuery,
    queryFn: () => Effect.runPromise(client.getProjects()),
    staleTime: 5 * 60 * 1000,
  });
}
