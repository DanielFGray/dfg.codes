import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware } from "effect/http-api";
import { boundaryErrors } from "@danielfgray/stompbox/http";

import { GitHubError, ProjectList, ProjectsCache } from "./projects.js";

export class FailureBoundary extends HttpApiMiddleware.Service<FailureBoundary>()(
  "dfg.codes/ProjectsFailureBoundary",
  { error: [...boundaryErrors, GitHubError] },
) {}

/** Provides `ProjectsCache` to the endpoint's handler. */
export class ProjectsMiddleware extends HttpApiMiddleware.Service<
  ProjectsMiddleware,
  { provides: ProjectsCache }
>()("dfg.codes/ProjectsMiddleware", { error: boundaryErrors }) {}

export const ProjectsGroup = HttpApiGroup.make("projects", { topLevel: true })
  .add(HttpApiEndpoint.get("getProjects", "/projects", { success: ProjectList }))
  .middleware(ProjectsMiddleware)
  .middleware(FailureBoundary)
  .prefix("/api");

export const ProjectsApi = HttpApi.make("projects").add(ProjectsGroup);
