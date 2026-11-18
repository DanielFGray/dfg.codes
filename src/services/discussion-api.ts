import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
} from 'effect/http-api'
import { Schema } from 'effect'

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
} from './discussion.js'

export class DiscussionSessionResponse extends Schema.Class<DiscussionSessionResponse>(
  'DiscussionSessionResponse',
)({
  authAvailable: Schema.Boolean,
  session: Schema.NullOr(AuthSession),
}) {}

export class DiscussionSuccess extends Schema.Class<DiscussionSuccess>('DiscussionSuccess')({
  success: Schema.Literal(true),
}) {}

export class DiscussionBadRequestError extends Schema.TaggedError<DiscussionBadRequestError>()(
  'DiscussionBadRequestError',
  {
    error: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

export class DiscussionUnauthorizedError extends Schema.TaggedError<
  DiscussionUnauthorizedError
>()(
  'DiscussionUnauthorizedError',
  {
    error: Schema.String,
  },
  { httpApiStatus: 401 },
) {}

export class DiscussionForbiddenError extends Schema.TaggedError<DiscussionForbiddenError>()(
  'DiscussionForbiddenError',
  {
    error: Schema.String,
  },
  { httpApiStatus: 403 },
) {}

export class DiscussionNotFoundError extends Schema.TaggedError<DiscussionNotFoundError>()(
  'DiscussionNotFoundError',
  {
    error: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

export class DiscussionUnavailableError extends Schema.TaggedError<
  DiscussionUnavailableError
>()('DiscussionUnavailableError', {
  error: Schema.String,
}, { httpApiStatus: 503 }) {}

export class DiscussionServicesMiddleware extends HttpApiMiddleware.Service<
  DiscussionServicesMiddleware,
  {
    provides: AuthService | CommentsService | PostLikesService | RequestIdentityService
  }
>()('DiscussionServicesMiddleware', {
  error: DiscussionUnavailableError,
}) {}

const SlugUrlParams = Schema.Struct({
  slug: ArticleSlug,
})

const GitHubAuthorizationUrlParams = Schema.Struct({
  redirect: Schema.optional(Schema.String),
})

const DeleteCommentParams = Schema.Struct({
  commentId: Schema.NumberFromString,
})

export const DiscussionGroup = HttpApiGroup.make('discussion', { topLevel: true })
  .add(
    HttpApiEndpoint.get('getSession', '/session', {
      success: DiscussionSessionResponse,
      error: DiscussionUnavailableError,
    }).middleware(DiscussionServicesMiddleware),
  )
  .add(
    HttpApiEndpoint.get('githubAuth', '/auth/github', {
      query: GitHubAuthorizationUrlParams,
    }),
  )
  .add(
    HttpApiEndpoint.get('githubCallback', '/auth/github/callback'),
  )
  .add(
    HttpApiEndpoint.get('getCommentStats', '/comment-stats', {
      success: CommentStats,
      error: [DiscussionBadRequestError, DiscussionUnavailableError],
    }).middleware(DiscussionServicesMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getThreadedComments', '/comments', {
      query: SlugUrlParams,
      success: CommentList,
      error: [DiscussionBadRequestError, DiscussionUnavailableError],
    }).middleware(DiscussionServicesMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createComment', '/comments', {
      payload: CreateCommentInput,
      success: Comment.pipe(HttpApiSchema.status(201)),
      error: [
        DiscussionBadRequestError,
        DiscussionUnauthorizedError,
        DiscussionForbiddenError,
        DiscussionNotFoundError,
        DiscussionUnavailableError,
      ],
    }).middleware(DiscussionServicesMiddleware),
  )
  .add(
    HttpApiEndpoint.delete('deleteComment', '/comments/:commentId', {
      params: DeleteCommentParams,
      success: DiscussionSuccess,
      error: [
        DiscussionBadRequestError,
        DiscussionUnauthorizedError,
        DiscussionForbiddenError,
        DiscussionNotFoundError,
        DiscussionUnavailableError,
      ],
    }).middleware(DiscussionServicesMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getTopPosts', '/top-posts', {
      success: TopPostsList,
      error: [DiscussionBadRequestError, DiscussionUnavailableError],
    }).middleware(DiscussionServicesMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getLikes', '/likes', {
      query: SlugUrlParams,
      success: Likes,
      error: [DiscussionBadRequestError, DiscussionUnavailableError],
    }).middleware(DiscussionServicesMiddleware),
  )
  .add(
    HttpApiEndpoint.post('sendLike', '/likes', {
      payload: SendLikeInput,
      success: Likes,
      error: [DiscussionBadRequestError, DiscussionUnavailableError],
    }).middleware(DiscussionServicesMiddleware),
  )
  .add(
    HttpApiEndpoint.post('signOut', '/auth/signout', {
      success: DiscussionSuccess,
      error: DiscussionUnavailableError,
    }).middleware(DiscussionServicesMiddleware),
  )
  .prefix('/api')

export const DiscussionApi = HttpApi.make('discussion').add(DiscussionGroup)
