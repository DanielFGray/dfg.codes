import { Context, Layer, Option } from "effect";

import type { AuthSession } from "../../src/services/discussion.js";

export interface RequestContextValue {
  readonly headers: Readonly<Record<string, string>>;
  readonly session: Option.Option<AuthSession>;
  readonly sessionCookieId: Option.Option<string>;
}

export const DiscussionRequestContext = Context.Service<RequestContextValue>(
  "dfg.codes/DiscussionRequestContext",
);

export const makeDiscussionRequestContext = (
  headers: Headers | Readonly<Record<string, string>>,
  session: Option.Option<AuthSession> = Option.none(),
  sessionCookieId: Option.Option<string> = Option.none(),
): RequestContextValue => ({
  headers: headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers,
  session,
  sessionCookieId,
});

export const DiscussionRequestContextLayer = (context: RequestContextValue) =>
  Layer.succeed(DiscussionRequestContext, context);
