import { expect, it } from "vitest";
import { Schema } from "effect";

import { GitHubTokenPayload, GitHubUserPayload } from "../discussion/github-oauth-payload.js";

it("the GitHub token payload schema accepts a token response", () => {
  expect(
    Schema.decodeUnknownSync(GitHubTokenPayload)({
      access_token: "token",
      scope: "read:user",
      token_type: "bearer",
    }),
  ).toEqual({
    access_token: "token",
    error: undefined,
    error_description: undefined,
    scope: "read:user",
    token_type: "bearer",
  });
});

it("the GitHub user payload schema accepts a user response", () => {
  expect(
    Schema.decodeUnknownSync(GitHubUserPayload)({
      avatar_url: null,
      id: 123,
      login: "octocat",
    }),
  ).toEqual({
    avatar_url: null,
    id: 123,
    login: "octocat",
    message: undefined,
  });
});
