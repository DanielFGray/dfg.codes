import type { DatabaseError } from "@danielfgray/stompbox/db";
import type { Forbidden, Unauthorized } from "@danielfgray/stompbox/http";
import { Context, Effect, Option, Schema as S } from "effect";

import type {
  CommentAlreadyDeleted,
  CommentNotFound,
  InvalidRedirect,
  InvalidVoteCount,
  OAuthFailed,
  ParentCommentNotFound,
} from "./discussion-errors.js";

export type CreateCommentError = DatabaseError | ParentCommentNotFound | Unauthorized;
export type DeleteCommentError =
  | CommentAlreadyDeleted
  | CommentNotFound
  | DatabaseError
  | Forbidden
  | Unauthorized;

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

export interface AuthServiceShape {
  getSession(): Effect.Effect<Option.Option<AuthSession>>;
  requireSession(): Effect.Effect<AuthSession, Unauthorized>;
  createGitHubAuthorizationUrl(
    redirectTo: string,
  ): Effect.Effect<URL, InvalidRedirect | OAuthFailed>;
  signOut(): Effect.Effect<void, DatabaseError>;
}

export class AuthService extends Context.Service<AuthService, AuthServiceShape>()("AuthService") {}

export interface RequestIdentityServiceShape {
  getActorId(): Effect.Effect<string, Unauthorized>;
}

export class RequestIdentityService extends Context.Service<
  RequestIdentityService,
  RequestIdentityServiceShape
>()("RequestIdentityService") {}

export interface CommentsServiceShape {
  getThreadedComments(slug: ArticleSlug): Effect.Effect<ReadonlyArray<Comment>, DatabaseError>;
  getCommentStats(): Effect.Effect<CommentStats, DatabaseError>;
  getTopPosts(): Effect.Effect<ReadonlyArray<TopPosts>, DatabaseError>;
  createComment(input: CreateCommentInput): Effect.Effect<Comment, CreateCommentError>;
  deleteComment(comment_id: number): Effect.Effect<void, DeleteCommentError>;
}

export class CommentsService extends Context.Service<CommentsService, CommentsServiceShape>()(
  "CommentsService",
) {}

export interface PostLikesServiceShape {
  getLikes(slug: ArticleSlug): Effect.Effect<Likes, DatabaseError>;
  sendLike(input: SendLikeInput): Effect.Effect<Likes, DatabaseError | InvalidVoteCount>;
}

export class PostLikesService extends Context.Service<PostLikesService, PostLikesServiceShape>()(
  "PostLikesService",
) {}
