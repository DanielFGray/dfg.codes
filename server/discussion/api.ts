import { FailureBoundaryLayer } from "@danielfgray/stompbox/http/server";
import { Effect, Layer, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { SqlClient } from "effect/sql/SqlClient";

import { AuthService, CommentsService, PostLikesService } from "../../src/services/discussion.js";
import {
  DiscussionApi,
  DiscussionServicesMiddleware,
  DiscussionSessionResponse,
  DiscussionSuccess,
  FailureBoundary,
} from "../../src/services/discussion-api.js";
import { toHttpError } from "../dbErrors.js";
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

const getRequestOrigin = (request: HttpServerRequest.HttpServerRequest) => {
  const host = request.headers["x-forwarded-host"] ?? request.headers.host ?? "localhost";
  const protocol = request.headers["x-forwarded-proto"] ?? "http";
  return `${protocol}://${host}`;
};

const getRequestUrl = (request: HttpServerRequest.HttpServerRequest) =>
  new URL(request.url, getRequestOrigin(request));

const makeDiscussionServicesLayer = (
  request: HttpServerRequest.HttpServerRequest,
  client: SqlClient,
) =>
  validateDiscussionSessionToken(request.cookies[getDiscussionSessionCookie()]).pipe(
    Effect.provideService(SqlClient, client),
    Effect.map((resolvedSession) =>
      DiscussionServicesLive.pipe(
        Layer.provide(Layer.succeed(SqlClient, client)),
        Layer.provide(
          DiscussionRequestContextLayer(
            makeDiscussionRequestContext(
              request.headers,
              Option.map(resolvedSession, ({ session }) => session),
              Option.map(resolvedSession, ({ cookieId }) => cookieId),
            ),
          ),
        ),
      ),
    ),
  );

const DiscussionServicesMiddlewareLive = Layer.effect(
  DiscussionServicesMiddleware,
  Effect.map(
    Effect.service(SqlClient),
    (client) => (httpApp) =>
      Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
        Effect.flatMap(makeDiscussionServicesLayer(request, client), (discussionLayer) =>
          httpApp.pipe(Effect.provide(discussionLayer)),
        ),
      ),
  ),
);

const OAuthRoutesLive = HttpApiBuilder.group(DiscussionApi, "oauth", (handlers) =>
  handlers
    .handleRaw("githubAuth", ({ query }) =>
      Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => {
        const rootUrl = getRequestOrigin(request);

        return createGitHubAuthorizationRequest(rootUrl, query.redirect).pipe(
          Effect.flatMap((authorization) =>
            HttpServerResponse.setCookie(
              HttpServerResponse.redirect(authorization.url.toString()),
              getGitHubOAuthStateCookie(),
              authorization.stateCookieValue,
              getGitHubOAuthStateCookieOptions(rootUrl),
            ).pipe(Effect.orDie),
          ),
        );
      }),
    )
    .handleRaw("githubCallback", () =>
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
              Effect.orDie,
            ),
          ),
        );
      }),
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
          ),
        ),
      ),
    )

    .handle("getCommentStats", () =>
      Effect.flatMap(Effect.service(CommentsService), (comments) => comments.getCommentStats()),
    )

    .handle("getThreadedComments", ({ query }) =>
      Effect.flatMap(Effect.service(CommentsService), (comments) =>
        comments.getThreadedComments(query.slug),
      ),
    )

    .handle("createComment", ({ payload }) =>
      Effect.flatMap(Effect.service(CommentsService), (comments) =>
        comments.createComment(payload),
      ),
    )

    .handle("deleteComment", ({ params }) =>
      Effect.flatMap(Effect.service(CommentsService), (comments) =>
        comments
          .deleteComment(params.commentId)
          .pipe(Effect.as(new DiscussionSuccess({ success: true }))),
      ),
    )

    .handle("getTopPosts", () =>
      Effect.flatMap(Effect.service(CommentsService), (comments) => comments.getTopPosts()),
    )

    .handle("getLikes", ({ query }) =>
      Effect.flatMap(Effect.service(PostLikesService), (likes) => likes.getLikes(query.slug)),
    )

    .handle("sendLike", ({ payload }) =>
      Effect.flatMap(Effect.service(PostLikesService), (likes) => likes.sendLike(payload)),
    )

    .handle("signOut", () =>
      Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
        Effect.service(AuthService).pipe(
          Effect.flatMap((auth) =>
            auth
              .signOut()
              .pipe(
                Effect.flatMap(() =>
                  HttpServerResponse.expireCookie(
                    HttpServerResponse.jsonUnsafe({ success: true as const }),
                    getDiscussionSessionCookie(),
                    getDiscussionSessionCookieOptions(getRequestOrigin(request)),
                  ).pipe(Effect.orDie),
                ),
              ),
          ),
        ),
      ),
    ),
);

/** The discussion API. It needs a `SqlClient`: the entry points provide `DatabaseLive`. */
export const ApiLive = HttpApiBuilder.layer(DiscussionApi).pipe(
  Layer.provide(DiscussionRoutesLive),
  Layer.provide(OAuthRoutesLive),
  Layer.provide(DiscussionServicesMiddlewareLive),
  Layer.provide(FailureBoundaryLayer.make(FailureBoundary, toHttpError)),
);
