import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

import { GitHubError, RepoInfo } from "../../src/services/projects.js";

const GitHubUser = "DanielFGray";

/** `process.env.GITHUB_TOKEN` when set; the REST endpoint works without one. */
const githubToken = Effect.sync(() => process.env.GITHUB_TOKEN);

const baseHeaders = (token: string | undefined, extra: Record<string, string> = {}) => ({
  Accept: "application/vnd.github+json",
  "User-Agent": "dfg.codes",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...extra,
});

/** Fail with a clean `GitHubError`, logging the real cause it came from. */
const toGitHubError = (message: string) => (cause: unknown) =>
  Effect.logWarning(message, cause).pipe(Effect.andThen(Effect.fail(new GitHubError({ message }))));

const failed = (message: string) => Effect.fail(new GitHubError({ message }));

const readStatus = (response: { readonly status: number }) =>
  response.status === 200 ? Effect.void : failed(`GitHub responded ${response.status}`);

/**
 * The REST list endpoint. One call returns every public repo, no token needed
 * (60 req/hr/IP unauthenticated). Forks and archived repos are dropped because
 * the projects section never advertises them.
 */
export const fetchRepos = Effect.gen(function* () {
  const token = yield* githubToken;

  const response = yield* HttpClient.execute(
    HttpClientRequest.get(
      `https://api.github.com/users/${GitHubUser}/repos?per_page=100&type=public`,
    ).pipe(HttpClientRequest.setHeaders(baseHeaders(token))),
  ).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.catch(toGitHubError("GitHub REST fetch failed")),
  );

  yield* readStatus(response);

  const json = yield* response.json.pipe(
    Effect.catch(toGitHubError("GitHub REST body failed")),
  );

  const repos = yield* Schema.decodeUnknownEffect(Schema.Array(RepoInfo))(json).pipe(
    Effect.catch(toGitHubError("GitHub REST decode failed")),
  );

  return repos
    .filter((repo) => !repo.fork && !repo.archived)
    .sort((a, b) => b.stargazers_count - a.stargazers_count);
});

const ReposQuery = `
  query Repos {
    user(login: "${GitHubUser}") {
      repositories(
        first: 100
        ownerAffiliations: OWNER
        isFork: false
        isArchived: false
        orderBy: { field: STARGAZERS, direction: DESC }
      ) {
        nodes {
          name
          description
          stargazerCount
          primaryLanguage { name }
          repositoryTopics(first: 10) { nodes { topic { name } } }
          url
          homepageUrl
          isFork
          isArchived
          pushedAt
        }
      }
    }
  }
`;

const GraphqlReposResponse = Schema.Struct({
  data: Schema.Struct({
    user: Schema.Struct({
      repositories: Schema.Struct({
        nodes: Schema.Array(
          Schema.Struct({
            name: Schema.String,
            description: Schema.NullOr(Schema.String),
            stargazerCount: Schema.Number,
            primaryLanguage: Schema.NullOr(Schema.Struct({ name: Schema.String })),
            repositoryTopics: Schema.Struct({
              nodes: Schema.Array(Schema.Struct({ topic: Schema.Struct({ name: Schema.String }) })),
            }),
            url: Schema.String,
            homepageUrl: Schema.NullOr(Schema.String),
            isFork: Schema.Boolean,
            isArchived: Schema.Boolean,
            pushedAt: Schema.NullOr(Schema.String),
          }),
        ),
      }),
    }),
  }),
});

/**
 * The same list via the GraphQL API. GraphQL requires a token: set
 * `GITHUB_TOKEN` (or `gh auth token`) before calling. Forks and archives are
 * excluded in the query itself.
 */
export const fetchReposGraphql = Effect.gen(function* () {
  const token = yield* githubToken;
  if (!token) {
    return yield* failed("GitHub GraphQL requires GITHUB_TOKEN");
  }

  const response = yield* HttpClient.execute(
    HttpClientRequest.post("https://api.github.com/graphql").pipe(
      HttpClientRequest.setHeaders(baseHeaders(token, { "Content-Type": "application/json" })),
      HttpClientRequest.bodyJsonUnsafe({ query: ReposQuery }),
    ),
  ).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.catch(toGitHubError("GitHub GraphQL fetch failed")),
  );

  yield* readStatus(response);

  const json = yield* response.json.pipe(
    Effect.catch(toGitHubError("GitHub GraphQL body failed")),
  );

  const decoded = yield* Schema.decodeUnknownEffect(GraphqlReposResponse)(json).pipe(
    Effect.catch(toGitHubError("GitHub GraphQL decode failed")),
  );

  return decoded.data.user.repositories.nodes.map((node) => ({
    name: node.name,
    description: node.description,
    stargazers_count: node.stargazerCount,
    language: node.primaryLanguage?.name ?? null,
    topics: node.repositoryTopics.nodes.map((topic) => topic.topic.name),
    html_url: node.url,
    homepage: node.homepageUrl,
    fork: node.isFork,
    archived: node.isArchived,
    pushed_at: node.pushedAt,
  }));
});
