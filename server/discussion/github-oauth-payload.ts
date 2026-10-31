import { Schema } from "effect";

export const GitHubTokenPayload = Schema.Struct({
  access_token: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
  error_description: Schema.optional(Schema.String),
  scope: Schema.optional(Schema.String),
  token_type: Schema.optional(Schema.String),
});

export const GitHubUserPayload = Schema.Struct({
  avatar_url: Schema.optional(Schema.NullishOr(Schema.String)),
  id: Schema.optional(Schema.Number),
  login: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
});
