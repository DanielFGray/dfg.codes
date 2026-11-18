import { boundaryErrors } from "@danielfgray/stompbox/http";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
} from "effect/http-api";
import { Schema } from "effect";

import {
  ArticleSlug,
  AuthSession,
  AuthService,
  Comment,
  CommentList,
  CommentStats,
  CommentsService,
  CreateCommentInput,
  Likes,
  PostLikesService,
  RequestIdentityService,
  SendLikeInput,
  TopPostsList,
} from "./discussion.js";
import {
  CommentAlreadyDeleted,
  CommentNotFound,
  InvalidRedirect,
  InvalidVoteCount,
  OAuthFailed,
  ParentCommentNotFound,
} from "./discussion-errors.js";

export class DiscussionSessionResponse extends Schema.Class<DiscussionSessionResponse>(
  "DiscussionSessionResponse",
)({
  authAvailable: Schema.Boolean,
  session: Schema.NullOr(AuthSession),
}) {}

export class DiscussionSuccess extends Schema.Class<DiscussionSuccess>("DiscussionSuccess")({
  success: Schema.Literal(true),
}) {}

/**
 * The failure boundary's tag: every class a request can fail with, listed once. The server
 * half is `FailureBoundaryLayer.make` in `server/discussion/api.ts`; its answer table can
 * raise only classes this list holds.
 */
export class FailureBoundary extends HttpApiMiddleware.Service<FailureBoundary>()(
  "dfg.codes/FailureBoundary",
  {
    error: [
      ...boundaryErrors,
      CommentAlreadyDeleted,
      CommentNotFound,
      InvalidRedirect,
      InvalidVoteCount,
      OAuthFailed,
      ParentCommentNotFound,
    ],
  },
) {}

export class DiscussionServicesMiddleware extends HttpApiMiddleware.Service<
  DiscussionServicesMiddleware,
  {
    provides: AuthService | CommentsService | PostLikesService | RequestIdentityService;
  }
>()("DiscussionServicesMiddleware", {
  error: boundaryErrors,
}) {}

const SlugUrlParams = Schema.Struct({
  slug: ArticleSlug,
});

const GitHubAuthorizationUrlParams = Schema.Struct({
  redirect: Schema.optional(Schema.String),
});

const DeleteCommentParams = Schema.Struct({
  commentId: Schema.NumberFromString,
});

// FailureBoundary comes after DiscussionServicesMiddleware, so it also answers a failure
// of the session lookup that middleware makes.
export const DiscussionGroup = HttpApiGroup.make("discussion", { topLevel: true })
  .add(HttpApiEndpoint.get("getSession", "/session", { success: DiscussionSessionResponse }))
  .add(HttpApiEndpoint.get("getCommentStats", "/comment-stats", { success: CommentStats }))
  .add(
    HttpApiEndpoint.get("getThreadedComments", "/comments", {
      query: SlugUrlParams,
      success: CommentList,
    }),
  )
  .add(
    HttpApiEndpoint.post("createComment", "/comments", {
      payload: CreateCommentInput,
      success: Comment.pipe(HttpApiSchema.status(201)),
    }),
  )
  .add(
    HttpApiEndpoint.delete("deleteComment", "/comments/:commentId", {
      params: DeleteCommentParams,
      success: DiscussionSuccess,
    }),
  )
  .add(HttpApiEndpoint.get("getTopPosts", "/top-posts", { success: TopPostsList }))
  .add(HttpApiEndpoint.get("getLikes", "/likes", { query: SlugUrlParams, success: Likes }))
  .add(HttpApiEndpoint.post("sendLike", "/likes", { payload: SendLikeInput, success: Likes }))
  .add(HttpApiEndpoint.post("signOut", "/auth/signout", { success: DiscussionSuccess }))
  .middleware(DiscussionServicesMiddleware)
  .middleware(FailureBoundary)
  .prefix("/api");

/** The GitHub redirects need no session, so they skip the services middleware. */
export const OAuthGroup = HttpApiGroup.make("oauth", { topLevel: true })
  .add(HttpApiEndpoint.get("githubAuth", "/auth/github", { query: GitHubAuthorizationUrlParams }))
  .add(HttpApiEndpoint.get("githubCallback", "/auth/github/callback"))
  .middleware(FailureBoundary)
  .prefix("/api");

export const DiscussionApi = HttpApi.make("discussion").add(DiscussionGroup).add(OAuthGroup);
