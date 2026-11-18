import { onSqlState } from "@danielfgray/stompbox/db";
import { Forbidden, Unauthorized } from "@danielfgray/stompbox/http";
import { Effect, Layer, Option, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

import {
  AuthService,
  type AuthSession,
  type ArticleSlug,
  CommentList,
  CommentsService,
  CommentStats,
  Likes,
  PostLikesService,
  type PostLikesServiceShape,
  RequestIdentityService,
  TopPostsList,
  type CommentsServiceShape,
  type RequestIdentityServiceShape,
  type CreateCommentInput,
} from "../../src/services/discussion.js";
import {
  CommentAlreadyDeleted,
  CommentNotFound,
  InvalidVoteCount,
  ParentCommentNotFound,
} from "../../src/services/discussion-errors.js";
import { query, withAuthContext } from "../db.js";
import {
  createConfiguredGitHubAuthorizationUrl,
  deleteDiscussionSession,
} from "../discussion/auth.js";
import {
  DiscussionRequestContext,
  type RequestContextValue,
} from "../discussion/request-context.js";

const signedInRequired = () => new Unauthorized({ message: "A signed-in session is required" });

const requireSession = (context: RequestContextValue): Effect.Effect<AuthSession, Unauthorized> =>
  Option.match(context.session, {
    onSome: Effect.succeed,
    onNone: () => Effect.fail(signedInRequired()),
  });

/**
 * Runs `effect` as the visitor on the request's connection pool. The `SqlClient` is taken
 * once, when the request's services are built, so a service method needs nothing from its caller.
 */
const authedBy =
  (context: RequestContextValue, client: SqlClient) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    withAuthContext(context, effect).pipe(Effect.provideService(SqlClient, client));

// Each row is one function result. The functions return JSON, so the row's declared type names
// the JSON the Schema decodes.
const ThreadedCommentsRow = Schema.Struct({ threaded_comments: CommentList });
const CommentStatsRow = Schema.Struct({ comments_stats: CommentStats.fields.countsBySlug });
const TopPostsRow = Schema.Struct({ top_posts: TopPostsList });
const LikesRow = (name: "get_likes" | "like_post") => Schema.Struct({ [name]: Likes });
const CreatedCommentRow = Schema.Struct({
  comment_id: Schema.Number,
  body: Schema.String,
  created_at: Schema.Date,
});
const CommentOwnerRow = Schema.Struct({
  comment_id: Schema.Number,
  user_id: Schema.String,
  deleted_at: Schema.NullOr(Schema.Date),
});
const DeletedCommentRow = Schema.Struct({ comment_id: Schema.Number });

export const AuthServiceLive = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const context = yield* DiscussionRequestContext;
    const client = yield* SqlClient;
    return {
      getSession: () => Effect.succeed(context.session),
      requireSession: () => requireSession(context),
      createGitHubAuthorizationUrl: createConfiguredGitHubAuthorizationUrl,
      signOut: () =>
        Option.match(context.sessionCookieId, {
          onSome: (cookieId) =>
            deleteDiscussionSession(cookieId).pipe(Effect.provideService(SqlClient, client)),
          onNone: () => Effect.void,
        }),
    };
  }),
);

export const RequestIdentityServiceLive = Layer.effect(
  RequestIdentityService,
  Effect.map(
    DiscussionRequestContext,
    (context): RequestIdentityServiceShape => ({
      getActorId: () => requireSession(context).pipe(Effect.map(({ user }) => user.user_id)),
    }),
  ),
);

export const CommentsServiceLive = Layer.effect(
  CommentsService,
  Effect.gen(function* () {
    const context = yield* DiscussionRequestContext;
    const authed = authedBy(context, yield* SqlClient);

    return {
      getThreadedComments: (slug: ArticleSlug) =>
        authed(
          query.one(ThreadedCommentsRow, (db) =>
            db.selectNoFrom((eb) =>
              eb
                .fn<typeof CommentList.Encoded>("threaded_comments", [eb.val(slug)])
                .as("threaded_comments"),
            ),
          ),
        ).pipe(Effect.map((row) => row.threaded_comments)),

      getCommentStats: () =>
        authed(
          query.one(CommentStatsRow, (db) =>
            db.selectNoFrom((eb) =>
              eb
                .fn<typeof CommentStats.fields.countsBySlug.Encoded>("comments_stats", [])
                .as("comments_stats"),
            ),
          ),
        ).pipe(Effect.map((row) => new CommentStats({ countsBySlug: row.comments_stats }))),

      getTopPosts: () =>
        authed(
          query.one(TopPostsRow, (db) =>
            db.selectNoFrom((eb) =>
              eb.fn<typeof TopPostsList.Encoded>("top_posts", []).as("top_posts"),
            ),
          ),
        ).pipe(Effect.map((row) => row.top_posts)),

      createComment: (input: CreateCommentInput) =>
        Effect.flatMap(requireSession(context), (session) =>
          authed(
            query.one(CreatedCommentRow, (db) =>
              db
                .insertInto("comments")
                .values({
                  body: input.body,
                  parent_id: input.parent_id,
                  slug: input.slug,
                  user_id: session.user.user_id,
                })
                .returning(["comment_id", "body", "created_at"]),
            ),
          ).pipe(
            // A foreign key failure on this insert means the parent comment is missing.
            onSqlState({
              "23503": () =>
                new ParentCommentNotFound({ message: "The parent comment does not exist" }),
            }),
            Effect.map((row) => ({
              body: row.body,
              children: [],
              comment_id: row.comment_id,
              created_at: row.created_at.toISOString(),
              user: session.user,
            })),
          ),
        ),

      deleteComment: (commentId: number) =>
        Effect.flatMap(requireSession(context), (session) =>
          authed(
            Effect.gen(function* () {
              const deleted = yield* query.maybe(DeletedCommentRow, (db) =>
                db
                  .updateTable("comments")
                  .set((eb) => ({ deleted_at: eb.fn("now", []) }))
                  .where("comment_id", "=", commentId)
                  .where("user_id", "=", session.user.user_id)
                  .where("deleted_at", "is", null)
                  .returning("comment_id"),
              );

              if (Option.isSome(deleted)) {
                return;
              }

              const comment = yield* query.maybe(CommentOwnerRow, (db) =>
                db
                  .selectFrom("comments")
                  .select(["comment_id", "user_id", "deleted_at"])
                  .where("comment_id", "=", commentId),
              );

              if (Option.isNone(comment)) {
                return yield* new CommentNotFound({ message: "The comment does not exist" });
              }

              if (comment.value.user_id !== session.user.user_id) {
                return yield* new Forbidden({
                  message: "You are not allowed to delete this comment",
                  reason: "access_denied",
                });
              }

              return yield* new CommentAlreadyDeleted({
                message: "The comment has already been deleted",
              });
            }),
          ),
        ),
    } satisfies CommentsServiceShape;
  }),
);

export const PostLikesServiceLive = Layer.effect(
  PostLikesService,
  Effect.gen(function* () {
    const context = yield* DiscussionRequestContext;
    const authed = authedBy(context, yield* SqlClient);

    return {
      getLikes: (slug) =>
        authed(
          query.one(LikesRow("get_likes"), (db) =>
            db.selectNoFrom((eb) =>
              eb.fn<typeof Likes.Encoded>("get_likes", [eb.val(slug)]).as("get_likes"),
            ),
          ),
        ).pipe(Effect.map((row) => row.get_likes)),

      sendLike: (input) =>
        authed(
          query.one(LikesRow("like_post"), (db) =>
            db.selectNoFrom((eb) =>
              eb
                .fn<typeof Likes.Encoded>("like_post", [
                  eb.val(input.post),
                  eb.val(input.requested_votes),
                ])
                .as("like_post"),
            ),
          ),
        ).pipe(
          // The votes column's check constraint refuses a count outside 0 to 10.
          onSqlState({
            "23514": () => new InvalidVoteCount({ message: "Votes must stay between 0 and 10" }),
          }),
          Effect.map((row) => row.like_post),
        ),
    } satisfies PostLikesServiceShape;
  }),
);

export const DiscussionServicesLive = Layer.mergeAll(
  AuthServiceLive,
  RequestIdentityServiceLive,
  CommentsServiceLive,
  PostLikesServiceLive,
);
