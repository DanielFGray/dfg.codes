import { Context, Effect, Option, Schema as S } from "effect";

export const ArticleSlug = S.String;
export type ArticleSlug = S.Schema.Type<typeof ArticleSlug>;

export class AuthUser extends S.Class<AuthUser>("AuthUser")({
  user_id: S.String,
  username: S.String,
  avatar_url: S.String,
}) {}

export class AuthSession extends S.Class<AuthSession>("AuthSession")({
  user: AuthUser,
}) {}

export type Comment = {
  readonly comment_id: number;
  readonly user: AuthUser;
  readonly body: string;
  readonly created_at: string;
  readonly children: ReadonlyArray<Comment>;
};

// TypeScript needs the narrow cast on the suspended self-reference to break the initialization cycle.
export const Comment = S.Struct({
  comment_id: S.Number,
  user: AuthUser,
  body: S.String,
  created_at: S.String,
  children: S.Array(S.suspend(() => Comment as S.Schema<Comment>)),
}).annotate({ identifier: "dfg/discussion/Comment" }) as unknown as S.Codec<
  Comment,
  Comment,
  never,
  never
>;

export class CommentStats extends S.Class<CommentStats>("CommentStats")({
  countsBySlug: S.Record(ArticleSlug, S.Number),
}) {}

export class CreateCommentInput extends S.Class<CreateCommentInput>("CreateCommentInput")({
  slug: ArticleSlug,
  body: S.String,
  parent_id: S.NullOr(S.Number),
}) {}

export class Likes extends S.Class<Likes>("Likes")({
  total: S.Number,
  available: S.Number,
  max: S.Number,
}) {}

export class LatestCommentUser extends S.Class<LatestCommentUser>("LatestCommentUser")({
  username: S.String,
  avatarUrl: S.String,
}) {}

export class TopPostLatestComment extends S.Class<TopPostLatestComment>("TopPostLatestComment")({
  comment_id: S.Number,
  user: LatestCommentUser,
  replying_to: LatestCommentUser,
  slug: ArticleSlug,
  body: S.String,
  created_at: S.String,
  updated_at: S.String,
}) {}

export class TopPosts extends S.Class<TopPosts>("TopPosts")({
  slug: ArticleSlug,
  comment_count: S.Number,
  total_votes: S.Number,
  latest_comment: S.optional(TopPostLatestComment),
}) {}

export const CommentList = S.Array(Comment);
export const TopPostsList = S.Array(TopPosts);

export class SendLikeInput extends S.Class<SendLikeInput>("SendLikeInput")({
  post: ArticleSlug,
  requested_votes: S.Number,
}) {}

export class AuthServiceError extends S.TaggedErrorClass<AuthServiceError>()("AuthServiceError", {
  reason: S.Literals(["not-authenticated", "invalid-redirect", "oauth-failed"]),
  message: S.String,
}) {}

export class RequestIdentityServiceError extends S.TaggedErrorClass<RequestIdentityServiceError>()(
  "RequestIdentityServiceError",
  {
    reason: S.Literal("missing-request-identity"),
    message: S.String,
  },
) {}

export class CommentsServiceError extends S.TaggedErrorClass<CommentsServiceError>()(
  "CommentsServiceError",
  {
    reason: S.Literals([
      "comment-not-found",
      "parent-comment-not-found",
      "not-authorized",
      "invalid-comment",
    ]),
    message: S.String,
  },
) {}

export class LikesServiceError extends S.TaggedErrorClass<LikesServiceError>()(
  "LikesServiceError",
  {
    reason: S.Literals(["invalid-vote-count", "missing-actor-id", "likes-unavailable"]),
    message: S.String,
  },
) {}

export interface AuthServiceShape {
  getSession(): Effect.Effect<Option.Option<AuthSession>, AuthServiceError>;
  requireSession(): Effect.Effect<AuthSession, AuthServiceError>;
  createGitHubAuthorizationUrl(redirectTo: string): Effect.Effect<URL, AuthServiceError>;
  signOut(): Effect.Effect<void, AuthServiceError>;
}

export class AuthService extends Context.Service<AuthService, AuthServiceShape>()("AuthService") {}

export interface RequestIdentityServiceShape {
  getActorId(): Effect.Effect<string, RequestIdentityServiceError>;
}

export class RequestIdentityService extends Context.Service<
  RequestIdentityService,
  RequestIdentityServiceShape
>()("RequestIdentityService") {}

export interface CommentsServiceShape {
  getThreadedComments(
    slug: ArticleSlug,
  ): Effect.Effect<ReadonlyArray<Comment>, CommentsServiceError>;
  getCommentStats(): Effect.Effect<CommentStats, CommentsServiceError>;
  getTopPosts(): Effect.Effect<ReadonlyArray<TopPosts>, CommentsServiceError>;
  createComment(input: CreateCommentInput): Effect.Effect<Comment, CommentsServiceError>;
  deleteComment(comment_id: number): Effect.Effect<void, CommentsServiceError>;
}

export class CommentsService extends Context.Service<CommentsService, CommentsServiceShape>()(
  "CommentsService",
) {}

export interface PostLikesServiceShape {
  getLikes(slug: ArticleSlug): Effect.Effect<Likes, LikesServiceError>;
  sendLike(input: SendLikeInput): Effect.Effect<Likes, LikesServiceError>;
}

export class PostLikesService extends Context.Service<PostLikesService, PostLikesServiceShape>()(
  "PostLikesService",
) {}
