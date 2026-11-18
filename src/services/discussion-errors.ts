import { Schema } from "effect";

// The refusals the discussion service raises beyond the generic classes of
// `@danielfgray/stompbox/http`. This module imports only `effect`, so the browser
// bundle can import it. Each class owns one status; the client tells them apart by `_tag`.

/** The comment to delete does not exist. */
export class CommentNotFound extends Schema.TaggedError<
  CommentNotFound,
  { readonly brand: unique symbol }
>()("CommentNotFound", { message: Schema.String }, { httpApiStatus: 404 }) {}

/** The comment a reply answers does not exist. */
export class ParentCommentNotFound extends Schema.TaggedError<
  ParentCommentNotFound,
  { readonly brand: unique symbol }
>()("ParentCommentNotFound", { message: Schema.String }, { httpApiStatus: 404 }) {}

/** The comment to delete is already deleted. */
export class CommentAlreadyDeleted extends Schema.TaggedError<
  CommentAlreadyDeleted,
  { readonly brand: unique symbol }
>()("CommentAlreadyDeleted", { message: Schema.String }, { httpApiStatus: 409 }) {}

/** A like request asked for a vote count outside the allowed range. */
export class InvalidVoteCount extends Schema.TaggedError<
  InvalidVoteCount,
  { readonly brand: unique symbol }
>()("InvalidVoteCount", { message: Schema.String }, { httpApiStatus: 400 }) {}

/** The sign-in redirect target leaves this site. */
export class InvalidRedirect extends Schema.TaggedError<
  InvalidRedirect,
  { readonly brand: unique symbol }
>()("InvalidRedirect", { message: Schema.String }, { httpApiStatus: 400 }) {}

/** GitHub sign-in is not configured or did not complete; the message is fixed text. */
export class OAuthFailed extends Schema.TaggedError<
  OAuthFailed,
  { readonly brand: unique symbol }
>()("OAuthFailed", { message: Schema.String }, { httpApiStatus: 503 }) {}
