import { Cause, Effect, Layer, Option, Match } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  AuthService,
  AuthServiceError,
  CommentsService,
  CommentsServiceError,
  LikesServiceError,
  PostLikesService,
} from "../../src/services/discussion.js";
import {
  DiscussionApi,
  DiscussionBadRequestError,
  DiscussionForbiddenError,
  DiscussionNotFoundError,
  DiscussionSessionResponse,
  DiscussionServicesMiddleware,
  DiscussionSuccess,
  DiscussionUnauthorizedError,
  DiscussionUnavailableError,
} from "../../src/services/discussion-api.js";
import {
  completeGitHubAuthorization,
  createGitHubAuthorizationRequest,
  getDiscussionSessionCookie,
  getDiscussionSessionCookieOptions,
  getGitHubOAuthStateCookie,
  getGitHubOAuthStateCookieOptions,
  isGitHubAuthConfigured,
  validateDiscussionSessionToken,
} from "./auth.js";
import { DiscussionRequestContextLayer, makeDiscussionRequestContext } from "./request-context.js";
import { DiscussionServicesLive } from "../services/discussion-live.js";

const mapAuthError = (error: AuthServiceError) => {
  switch (error.reason) {
    case "invalid-redirect":
      return new DiscussionBadRequestError({ error: error.message });
    case "not-authenticated":
      return new DiscussionUnauthorizedError({ error: error.message });
    case "oauth-failed":
      return new DiscussionUnavailableError({ error: error.message });
  }
};

const mapContextError = (error: AuthServiceError) =>
  new DiscussionUnavailableError({ error: error.message });

const mapUnavailableError = (error: { readonly message: string }) =>
  new DiscussionUnavailableError({ error: error.message });

const mapCommentReadError = (error: CommentsServiceError) => {
  switch (error.reason) {
    case "invalid-comment":
      return new DiscussionBadRequestError({ error: error.message });
    default:
      return new DiscussionUnavailableError({ error: error.message });
  }
};

const mapCommentWriteError = (error: CommentsServiceError) => {
  switch (error.reason) {
    case "comment-not-found":
    case "parent-comment-not-found":
      return new DiscussionNotFoundError({ error: error.message });
    case "not-authorized":
      return error.message === "A signed-in session is required"
        ? new DiscussionUnauthorizedError({ error: error.message })
        : new DiscussionForbiddenError({ error: error.message });
    case "invalid-comment":
      return new DiscussionBadRequestError({ error: error.message });
  }
};

const mapLikesError = (error: LikesServiceError) => {
  switch (error.reason) {
    case "invalid-vote-count":
      return new DiscussionBadRequestError({ error: error.message });
    case "likes-unavailable":
      return new DiscussionUnavailableError({ error: error.message });
    default:
      return new DiscussionUnavailableError({ error: error.message });
  }
};

const responseForCause = (
  cause: Cause.Cause<unknown>,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, never> => {
  const error = Cause.squash(cause);

  return Match.type().pipe(
    Match.when(Match.instanceOf(DiscussionBadRequestError), (error) =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: error.error }, { status: 400 })),
    ),

    Match.when(Match.instanceOf(DiscussionForbiddenError), (error) =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: error.error }, { status: 403 })),
    ),

    Match.when(Match.instanceOf(DiscussionNotFoundError), (error) =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: error.error }, { status: 404 })),
    ),

    Match.when(Match.instanceOf(DiscussionUnavailableError), (error) =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ error: error.error }, { status: 503 })),
    ),

    Match.when(Match.instanceOf(AuthServiceError), (error) => {
      const mapped = mapAuthError(error);
      return responseForCause(Cause.fail(mapped));
    }),

    Match.orElse(() =>
      Effect.succeed(
        HttpServerResponse.jsonUnsafe(
          { error: error instanceof Error ? error.message : "Discussion auth failed" },
          { status: 500 },
        ),
      ),
    ),
  )(error);
};

const getRequestOrigin = (request: HttpServerRequest.HttpServerRequest) => {
  const host = request.headers["x-forwarded-host"] ?? request.headers.host ?? "localhost";
  const protocol = request.headers["x-forwarded-proto"] ?? "http";
  return `${protocol}://${host}`;
};

const getRequestUrl = (request: HttpServerRequest.HttpServerRequest) =>
  new URL(request.url, getRequestOrigin(request));

const makeDiscussionServicesLayer = (request: HttpServerRequest.HttpServerRequest) =>
  validateDiscussionSessionToken(request.cookies[getDiscussionSessionCookie()]).pipe(
    Effect.map((resolvedSession) =>
      DiscussionServicesLive.pipe(
        Layer.provide(
          DiscussionRequestContextLayer(
            makeDiscussionRequestContext(
              request.headers,
              Option.match(resolvedSession, {
                onNone: () => Option.none(),
                onSome: ({ session }) => Option.some(session),
              }),
              Option.match(resolvedSession, {
                onNone: () => Option.none(),
                onSome: ({ cookieId }) => Option.some(cookieId),
              }),
            ),
          ),
        ),
      ),
    ),
    Effect.mapError(mapContextError),
  );

const DiscussionServicesMiddlewareLive = Layer.succeed(DiscussionServicesMiddleware, (httpApp) =>
  Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
    Effect.flatMap(makeDiscussionServicesLayer(request), (discussionLayer) =>
      httpApp.pipe(Effect.provide(discussionLayer)),
    ),
  ),
);

const DiscussionRoutesLive = HttpApiBuilder.group(DiscussionApi, "discussion", (handlers) =>
  handlers
    .handle("getSession", () =>
      Effect.service(AuthService).pipe(
        Effect.flatMap((auth) =>
          auth.getSession().pipe(
            Effect.map(
              (session) =>
                new DiscussionSessionResponse({
                  authAvailable: isGitHubAuthConfigured(),
                  session: Option.getOrNull(session),
                }),
            ),
            Effect.mapError(mapContextError),
          ),
        ),
      ),
    )
    .handleRaw(
      "githubAuth",
      ({ query }) => {
        const requestEffect = HttpServerRequest.HttpServerRequest;

        return Effect.flatMap(requestEffect, (request) => {
        const rootUrl = getRequestOrigin(request);

        return createGitHubAuthorizationRequest(rootUrl, query.redirect).pipe(
          Effect.flatMap((authorization) =>
            HttpServerResponse.setCookie(
              HttpServerResponse.redirect(authorization.url.toString()),
              getGitHubOAuthStateCookie(),
              authorization.stateCookieValue,
              getGitHubOAuthStateCookieOptions(rootUrl),
            ),
          ),
          Effect.catchCause(responseForCause),
        );
        });
      },
    )

    .handleRaw(
      "githubCallback",
      () =>
        Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => {
          const rootUrl = getRequestOrigin(request);
          const url = getRequestUrl(request);

          return completeGitHubAuthorization(
            rootUrl,
            url.searchParams.get("code"),
            url.searchParams.get("state"),
            request.cookies[getGitHubOAuthStateCookie()],
          ).pipe(
            Effect.flatMap((completed) =>
              HttpServerResponse.setCookie(
                HttpServerResponse.redirect(completed.redirect),
                getDiscussionSessionCookie(),
                completed.token,
                getDiscussionSessionCookieOptions(rootUrl),
              ).pipe(
                Effect.flatMap((response) =>
                  HttpServerResponse.expireCookie(
                    response,
                    getGitHubOAuthStateCookie(),
                    getGitHubOAuthStateCookieOptions(rootUrl),
                  ),
                ),
              ),
            ),
            Effect.catchCause(responseForCause),
          );
        }),
    )

    .handle("getCommentStats", () =>
      Effect.service(CommentsService).pipe(
        Effect.flatMap((comments) =>
          comments.getCommentStats().pipe(Effect.mapError(mapCommentReadError)),
        ),
      ),
    )

    .handle("getThreadedComments", ({ query }) =>
      Effect.service(CommentsService).pipe(
        Effect.flatMap((comments) =>
          comments.getThreadedComments(query.slug).pipe(Effect.mapError(mapCommentReadError)),
        ),
      ),
    )

    .handle("createComment", ({ payload }) =>
      Effect.service(CommentsService).pipe(
        Effect.flatMap((comments) =>
          comments.createComment(payload).pipe(Effect.mapError(mapCommentWriteError)),
        ),
      ),
    )

    .handle("deleteComment", ({ params }) =>
      Effect.service(CommentsService).pipe(
        Effect.flatMap((comments) =>
          comments
            .deleteComment(params.commentId)
            .pipe(
              Effect.mapError(mapCommentWriteError),
              Effect.as(new DiscussionSuccess({ success: true })),
            ),
        ),
      ),
    )

    .handle("getTopPosts", () =>
      Effect.service(CommentsService).pipe(
        Effect.flatMap((comments) =>
          comments.getTopPosts().pipe(Effect.mapError(mapCommentReadError)),
        ),
      ),
    )

    .handle("getLikes", ({ query }) =>
      Effect.service(PostLikesService).pipe(
        Effect.flatMap((likes) => likes.getLikes(query.slug).pipe(Effect.mapError(mapLikesError))),
      ),
    )

    .handle("sendLike", ({ payload }) =>
      Effect.service(PostLikesService).pipe(
        Effect.flatMap((likes) => likes.sendLike(payload).pipe(Effect.mapError(mapLikesError))),
      ),
    )

    .handle("signOut", () =>
      Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
        Effect.service(AuthService).pipe(
          Effect.flatMap((auth) =>
            auth.signOut().pipe(
              Effect.mapError(mapUnavailableError),
              Effect.flatMap(() =>
                HttpServerResponse.expireCookie(
                  HttpServerResponse.jsonUnsafe({ success: true as const }),
                  getDiscussionSessionCookie(),
                  getDiscussionSessionCookieOptions(getRequestOrigin(request)),
                ),
              ),
              Effect.mapError(mapUnavailableError),
            ),
          ),
        ),
      ),
    ),
);

export const ApiLive = HttpApiBuilder.layer(DiscussionApi).pipe(
  Layer.provide(DiscussionRoutesLive),
  Layer.provide(DiscussionServicesMiddlewareLive),
);
