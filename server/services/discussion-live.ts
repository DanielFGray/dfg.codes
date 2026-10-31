import { Effect, Layer, Option, Schema } from "effect";

import {
  AuthService,
  AuthServiceError,
  type AuthSession,
  CommentList,
  CommentsService,
  CommentsServiceError,
  CommentStats,
  Likes,
  LikesServiceError,
  PostLikesService,
  type PostLikesServiceShape,
  RequestIdentityService,
  RequestIdentityServiceError,
  TopPostsList,
  type CommentsServiceShape,
  type RequestIdentityServiceShape,
  type CreateCommentInput,
} from "../../src/services/discussion.js";
import { SqlError, executeTakeFirst, type DiscussionTransaction, withAuthContext } from "../db.js";
import {
  createConfiguredGitHubAuthorizationUrl,
  deleteDiscussionSession,
} from "../discussion/auth.js";
import {
  DiscussionRequestContext,
  type RequestContextValue,
} from "../discussion/request-context.js";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unexpected discussion service error";

const sqlErrorCode = (error: SqlError) => {
  const cause = error.cause;

  return typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof cause.code === "string"
    ? cause.code
    : undefined;
};

const mapCommentsError = (error: unknown) => {
  if (error instanceof CommentsServiceError) {
    return error;
  }

  if (error instanceof SqlError) {
    switch (sqlErrorCode(error)) {
      case "23503":
        return new CommentsServiceError({
          reason: "parent-comment-not-found",
          message: "The parent comment does not exist",
        });
      case "23514":
      case "22001":
        return new CommentsServiceError({
          reason: "invalid-comment",
          message: "The comment payload is invalid",
        });
      case "42501":
        return new CommentsServiceError({
          reason: "not-authorized",
          message: "You are not allowed to modify this comment",
        });
      default:
        return new CommentsServiceError({
          reason: "invalid-comment",
          message: errorMessage(error.cause),
        });
    }
  }

  return new CommentsServiceError({
    reason: "invalid-comment",
    message: errorMessage(error),
  });
};

const mapLikesError = (error: unknown) => {
  if (error instanceof LikesServiceError) {
    return error;
  }

  if (error instanceof SqlError) {
    switch (sqlErrorCode(error)) {
      case "23514":
        return new LikesServiceError({
          reason: "invalid-vote-count",
          message: "Votes must stay between 0 and 10",
        });
      default:
        return new LikesServiceError({
          reason: "likes-unavailable",
          message: errorMessage(error.cause),
        });
    }
  }

  return new LikesServiceError({
    reason: "likes-unavailable",
    message: errorMessage(error),
  });
};

const decodeCommentsValue = (value: unknown) =>
  Schema.decodeUnknownEffect(CommentList)(value).pipe(
    Effect.mapError(
      (error) =>
        new CommentsServiceError({
          reason: "invalid-comment",
          message: errorMessage(error),
        }),
    ),
  );

const decodeCommentStatsValue = (value: unknown) =>
  Schema.decodeUnknownEffect(CommentStats)(value).pipe(
    Effect.mapError(
      (error) =>
        new CommentsServiceError({
          reason: "invalid-comment",
          message: errorMessage(error),
        }),
    ),
  );

const decodeTopPostsValue = (value: unknown) =>
  Schema.decodeUnknownEffect(TopPostsList)(value).pipe(
    Effect.mapError(
      (error) =>
        new CommentsServiceError({
          reason: "invalid-comment",
          message: errorMessage(error),
        }),
    ),
  );

const decodeLikesValue = (value: unknown) =>
  Schema.decodeUnknownEffect(Likes)(value).pipe(
    Effect.mapError(
      (error) =>
        new LikesServiceError({
          reason: "likes-unavailable",
          message: errorMessage(error),
        }),
    ),
  );

const requireAuthSession = (
  context: RequestContextValue,
): Effect.Effect<AuthSession, AuthServiceError> =>
  Option.match(context.session, {
    onSome: (session) => Effect.succeed(session),
    onNone: () =>
      Effect.fail(
        new AuthServiceError({
          reason: "not-authenticated",
          message: "A signed-in session is required",
        }),
      ),
  });

const requireCommentSession = (
  context: RequestContextValue,
): Effect.Effect<AuthSession, CommentsServiceError> =>
  Option.match(context.session, {
    onSome: (session) => Effect.succeed(session),
    onNone: () =>
      Effect.fail(
        new CommentsServiceError({
          reason: "not-authorized",
          message: "A signed-in session is required",
        }),
      ),
  });

export const AuthServiceLive = Layer.effect(
  AuthService,
  Effect.map(DiscussionRequestContext, (context) => ({
    getSession: () => Effect.succeed(context.session),
    requireSession: () => requireAuthSession(context),
    createGitHubAuthorizationUrl: createConfiguredGitHubAuthorizationUrl,
    signOut: () =>
      Option.match(context.sessionCookieId, {
        onSome: (cookieId) => deleteDiscussionSession(cookieId),
        onNone: () => Effect.void,
      }),
  })),
);

export const RequestIdentityServiceLive = Layer.effect(
  RequestIdentityService,
  Effect.map(
    DiscussionRequestContext,
    (context): RequestIdentityServiceShape => ({
      getActorId: () =>
        Option.match(context.session, {
          onSome: ({ user }) => Effect.succeed(user.user_id),
          onNone: () =>
            Effect.fail(
              new RequestIdentityServiceError({
                reason: "missing-request-identity",
                message: "The request does not have an authenticated actor",
              }),
            ),
        }),
    }),
  ),
);

export const CommentsServiceLive = Layer.effect(
  CommentsService,
  Effect.map(
    DiscussionRequestContext,
    (context): CommentsServiceShape => ({
      getThreadedComments: (slug) =>
        withAuthContext(
          context,
          Effect.fnUntraced(function* (db) {
            const comments = yield* executeTakeFirst(
              db.selectNoFrom((eb) =>
                eb.fn<unknown>("threaded_comments", [eb.val(slug)]).as("threaded_comments"),
              ),
            ).pipe(
              Effect.map(
                Option.match({ onSome: (row) => row.threaded_comments, onNone: () => [] }),
              ),
              Effect.flatMap(decodeCommentsValue),
            );

            return comments;
          }),
        ).pipe(Effect.mapError(mapCommentsError)),

      getCommentStats: () =>
        withAuthContext(
          context,
          Effect.fnUntraced(function* (db) {
            const stats = yield* executeTakeFirst(
              db.selectNoFrom((eb) => eb.fn<unknown>("comments_stats", []).as("comments_stats")),
            ).pipe(
              Effect.map(
                Option.match({
                  onSome: (row) => ({ countsBySlug: row.comments_stats }),
                  onNone: () => ({ countsBySlug: {} }),
                }),
              ),
              Effect.flatMap(decodeCommentStatsValue),
            );

            return stats;
          }),
        ).pipe(Effect.mapError(mapCommentsError)),

      getTopPosts: () =>
        withAuthContext(
          context,
          Effect.fnUntraced(function* (db) {
            const topPosts = yield* executeTakeFirst(
              db.selectNoFrom((eb) => eb.fn<unknown>("top_posts", []).as("top_posts")),
            ).pipe(
              Effect.map(Option.match({ onSome: (row) => row.top_posts, onNone: () => [] })),
              Effect.flatMap(decodeTopPostsValue),
            );

            return topPosts;
          }),
        ).pipe(Effect.mapError(mapCommentsError)),

      createComment: (input: CreateCommentInput) =>
        requireCommentSession(context).pipe(
          Effect.flatMap((session) =>
            withAuthContext(
              context,
              Effect.fnUntraced(function* (db) {
                const row = yield* executeTakeFirst(
                  db
                    .insertInto("comments")
                    .values({
                      body: input.body,
                      parent_id: input.parent_id,
                      slug: input.slug,
                      user_id: session.user.user_id,
                    })
                    .returning(["comment_id", "body", "created_at"]),
                ).pipe(
                  Effect.flatMap(
                    Option.match({
                      onSome: (row) =>
                        Effect.succeed({
                          body: row.body,
                          children: [],
                          comment_id: row.comment_id,
                          created_at:
                            row.created_at instanceof Date
                              ? row.created_at.toISOString()
                              : `${row.created_at}`,
                          user: session.user,
                        }),
                      onNone: () =>
                        Effect.fail(
                          new CommentsServiceError({
                            reason: "invalid-comment",
                            message: "The comment could not be created",
                          }),
                        ),
                    }),
                  ),
                );

                return row;
              }),
            ),
          ),
          Effect.mapError(mapCommentsError),
        ),

      deleteComment: (commentId: number) =>
        requireCommentSession(context).pipe(
          Effect.flatMap((session) =>
            withAuthContext(
              context,
              Effect.fnUntraced(function* (db: DiscussionTransaction) {
                const deletedComment = yield* executeTakeFirst(
                  db
                    .updateTable("comments")
                    .set((eb) => ({ deleted_at: eb.fn("now", []) }))
                    .where("comment_id", "=", commentId)
                    .where("user_id", "=", session.user.user_id)
                    .where("deleted_at", "is", null)
                    .returning("comment_id"),
                );

                if (Option.isSome(deletedComment)) {
                  return;
                }

                const comment = yield* executeTakeFirst(
                  db
                    .selectFrom("comments")
                    .select(["comment_id", "user_id", "deleted_at"])
                    .where("comment_id", "=", commentId),
                );

                if (Option.isNone(comment)) {
                  return yield* new CommentsServiceError({
                    reason: "comment-not-found",
                    message: "The comment does not exist",
                  });
                }

                if (comment.value.user_id !== session.user.user_id) {
                  return yield* new CommentsServiceError({
                    reason: "not-authorized",
                    message: "You are not allowed to delete this comment",
                  });
                }

                return yield* new CommentsServiceError({
                  reason: "invalid-comment",
                  message: "The comment has already been deleted",
                });
              }),
            ),
          ),
          Effect.mapError(mapCommentsError),
        ),
    }),
  ),
);

export const PostLikesServiceLive = Layer.effect(
  PostLikesService,
  Effect.map(
    DiscussionRequestContext,
    (context): PostLikesServiceShape => ({
      getLikes: (slug) =>
        withAuthContext(
          context,
          Effect.fnUntraced(function* (db) {
            const likes = yield* executeTakeFirst(
              db.selectNoFrom((eb) => eb.fn<unknown>("get_likes", [eb.val(slug)]).as("get_likes")),
            ).pipe(
              Effect.map(
                Option.match({
                  onSome: (r) => r.get_likes,
                  onNone: () => ({
                    available: 10,
                    max: 10,
                    total: 0,
                  }),
                }),
              ),
              Effect.flatMap(decodeLikesValue),
            );

            return likes;
          }),
        ).pipe(Effect.mapError(mapLikesError)),

      sendLike: (input) =>
        withAuthContext(
          context,
          Effect.fnUntraced(function* (db) {
            const likes = yield* executeTakeFirst(
              db.selectNoFrom((eb) =>
                eb
                  .fn<unknown>("like_post", [eb.val(input.post), eb.val(input.requested_votes)])
                  .as("like_post"),
              ),
            ).pipe(
              Effect.map(
                Option.match({
                  onSome: (r) => r.like_post,
                  onNone: () => ({
                    available: 10,
                    max: 10,
                    total: 0,
                  }),
                }),
              ),
              Effect.flatMap(decodeLikesValue),
            );
            return likes;
          }),
        ).pipe(Effect.mapError(mapLikesError)),
    }),
  ),
);

export const DiscussionServicesLive = Layer.mergeAll(
  AuthServiceLive,
  RequestIdentityServiceLive,
  CommentsServiceLive,
  PostLikesServiceLive,
);
