import { Context, Effect, Schema as S } from "effect";

export const Category = S.Literals(["apps", "dev-tools", "agent-tooling", "sites"] as const);
export type Category = S.Schema.Type<typeof Category>;

export class Project extends S.Class<Project>("Project")({
  name: S.String,
  description: S.NullOr(S.String),
  category: Category,
  stars: S.NullOr(S.Number),
  language: S.NullOr(S.String),
  liveUrl: S.NullOr(S.String),
  repoUrl: S.NullOr(S.String),
}) {}

export const ProjectList = S.Array(Project);

/** GitHub could not answer the projects list. The client may retry later. */
export class GitHubError extends S.TaggedError<GitHubError, { readonly brand: unique symbol }>()(
  "GitHubError",
  { message: S.String },
  { httpApiStatus: 503 },
) {}

/** A GitHub repository as fetched, before it is merged with the registry. */
export const RepoInfo = S.Struct({
  name: S.String,
  description: S.NullOr(S.String),
  stargazers_count: S.Number,
  language: S.NullOr(S.String),
  topics: S.Array(S.String),
  html_url: S.String,
  homepage: S.NullOr(S.String),
  fork: S.Boolean,
  archived: S.Boolean,
  pushed_at: S.NullOr(S.String),
});

export type RepoInfo = S.Schema.Type<typeof RepoInfo>;

/** The cached GitHub list, shared between the endpoint and any future callers. */
export interface ProjectsCacheShape {
  readonly get: Effect.Effect<readonly RepoInfo[], GitHubError>;
  readonly refresh: Effect.Effect<void, GitHubError>;
}

export class ProjectsCache extends Context.Service<ProjectsCache, ProjectsCacheShape>()(
  "dfg/ProjectsCache",
) {}
