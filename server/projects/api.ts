import { FailureBoundaryLayer } from "@danielfgray/stompbox/http/server";
import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { projects } from "../../src/data/projects.js";
import { Project, ProjectsCache, type RepoInfo } from "../../src/services/projects.js";
import { FailureBoundary, ProjectsApi, ProjectsMiddleware } from "../../src/services/projects-api.js";
import { toHttpError } from "../dbErrors.js";
import { ProjectsCacheLive } from "./cache.js";

/**
 * Join the in-repo registry (selection, category, live link) with the cached
 * GitHub data (description, stars, language, repo link). A registry entry with
 * no public repo keeps its hand-written description and has no repo link.
 */
export const mergeProjects = (repos: readonly RepoInfo[]): readonly Project[] => {
  const byName = new Map(repos.map((repo) => [repo.name, repo] as const));

  return projects.map((entry) => {
    const repo = byName.get(entry.gh ?? entry.name);
    return new Project({
      name: entry.name,
      description: repo?.description ?? entry.description ?? null,
      category: entry.category,
      stars: repo?.stargazers_count ?? null,
      language: repo?.language ?? null,
      liveUrl: entry.liveUrl ?? null,
      repoUrl: repo?.html_url ?? null,
    });
  });
};

const ProjectsRoutesLive = HttpApiBuilder.group(ProjectsApi, "projects", (handlers) =>
  handlers.handle("getProjects", () =>
    Effect.flatMap(ProjectsCache, (cache) => cache.get.pipe(Effect.map(mergeProjects))),
  ),
);

const ProjectsMiddlewareLive = Layer.effect(
  ProjectsMiddleware,
  Effect.map(ProjectsCache, (cache) => (httpApp) =>
    httpApp.pipe(Effect.provideService(ProjectsCache, cache)),
  ),
);

export const ProjectsApiLive = HttpApiBuilder.layer(ProjectsApi).pipe(
  Layer.provide(ProjectsRoutesLive),
  Layer.provide(ProjectsMiddlewareLive),
  Layer.provide(FailureBoundaryLayer.make(FailureBoundary, toHttpError)),
  Layer.provide(ProjectsCacheLive),
);
