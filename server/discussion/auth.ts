import crypto from "node:crypto";

import { Effect, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { AuthSession, AuthServiceError, AuthUser } from "../../src/services/discussion.js";
import { executeQuery, executeTakeFirst, withVisitorRole } from "../db.js";
import { GitHubTokenPayload, GitHubUserPayload } from "./github-oauth-payload.js";

class GitHubOAuthState extends Schema.Class<GitHubOAuthState>("GitHubOAuthState")({
  redirect: Schema.String,
  state: Schema.String,
}) {}

type GitHubUser = {
  readonly avatar_url: string | null;
  readonly id: string;
  readonly login: string;
};

type ValidatedSession = {
  readonly cookieId: string;
  readonly session: AuthSession;
};

const sessionCookieName = "discussion_session";
const oauthStateCookieName = "discussion_github_oauth";
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;
const oauthStateTtlSeconds = 60 * 10;
const oauthStateTtlMs = oauthStateTtlSeconds * 1000;

const base64UrlEncode = (value: string) => Buffer.from(value, "utf8").toString("base64url");

const base64UrlDecode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const hashSecret = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

const randomHex = (bytes: number) => crypto.randomBytes(bytes).toString("hex");

const isSecureCookieOrigin = (rootUrl: string) => {
  try {
    return new URL(rootUrl).protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeRedirect = (value: string | null | undefined) => {
  if (!value) {
    return "/";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return;
  }

  return value;
};

const configuredRootUrl = () => process.env.VITE_ROOT_URL;

const requireGitHubConfiguration = () => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new AuthServiceError({
      reason: "oauth-failed",
      message: "GitHub OAuth is not configured",
    });
  }

  return { clientId, clientSecret };
};

const toOAuthError = (fallbackMessage: string) => (error: unknown) =>
  new AuthServiceError({
    reason: "oauth-failed",
    message: error instanceof Error ? error.message : fallbackMessage,
  });

const executeGitHubRequest = <E, R>(
  request: Effect.Effect<HttpClientRequest.HttpClientRequest, E, R>,
  failureMessage: string,
) =>
  request.pipe(
    Effect.flatMap(HttpClient.execute),
    Effect.mapError(toOAuthError(failureMessage)),
    Effect.provide(FetchHttpClient.layer),
  );

const readGitHubPayload = <A>(
  response: { readonly json: Effect.Effect<unknown, unknown, never> },
  schema: Schema.Decoder<A, never>,
  failureMessage: string,
) =>
  response.json.pipe(
    Effect.mapError(toOAuthError(failureMessage)),
    Effect.flatMap((value) =>
      Effect.try({
        try: () => Schema.decodeUnknownSync(schema)(value),
        catch: toOAuthError(failureMessage),
      }),
    ),
  );

const encodeOAuthState = (state: GitHubOAuthState) => base64UrlEncode(JSON.stringify(state));

const decodeOAuthState = (cookieValue: string | undefined) => {
  if (!cookieValue) {
    return Option.none<GitHubOAuthState>();
  }

  try {
    return Option.some(
      Schema.decodeUnknownSync(GitHubOAuthState)(JSON.parse(base64UrlDecode(cookieValue))),
    );
  } catch {
    return Option.none<GitHubOAuthState>();
  }
};

const toAuthSession = (user: {
  readonly avatar_url: string | null;
  readonly user_id: string;
  readonly username: string;
}): AuthSession => ({
  user: new AuthUser({
    avatar_url: user.avatar_url ?? "",
    user_id: user.user_id,
    username: user.username,
  }),
});

const parseSessionToken = (token: string | undefined) => {
  if (!token) {
    return;
  }

  const [cookieId, secret, ...rest] = token.split(".");

  if (!cookieId || !secret || rest.length > 0) {
    return;
  }

  return { cookieId, secret };
};

const normalizeGitHubUsername = (login: string) => {
  const sanitized = login
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (sanitized.length >= 3) {
    return sanitized.slice(0, 32);
  }

  return `github-${sanitized || "user"}`.slice(0, 32);
};

/** Finds or creates the GitHub account's user and starts a session; returns the session token. */
const signInGitHubUser = Effect.fnUntraced(function* (githubUser: GitHubUser) {
  const cookieId = randomHex(24);
  const secret = randomHex(32);
  const user = yield* callSessionUserFunction(
    "auth.sign_in_github",
    [
      githubUser.id,
      normalizeGitHubUsername(githubUser.login),
      githubUser.avatar_url,
      cookieId,
      hashSecret(secret),
      new Date(Date.now() + sessionTtlMs),
    ],
    "Signing in with GitHub failed",
  );

  if (Option.isNone(user)) {
    return yield* Effect.fail(
      new AuthServiceError({
        reason: "oauth-failed",
        message: "GitHub authentication did not create a user",
      }),
    );
  }

  return { session: toAuthSession(user.value), token: `${cookieId}.${secret}` };
});

const SessionUser = Schema.Struct({
  avatar_url: Schema.NullOr(Schema.String),
  user_id: Schema.String,
  username: Schema.String,
});

/**
 * Calls an auth function as the visitor role. The function returns the session's user as JSON,
 * or null when there is none. Only these functions may read or write the identity tables.
 */
const callSessionUserFunction = (
  name: "auth.sign_in_github" | "auth.find_session",
  args: ReadonlyArray<string | Date | null>,
  failureMessage: string,
) =>
  withVisitorRole((db) =>
    executeTakeFirst(
      db.selectNoFrom((eb) => eb.fn<unknown>(name, args.map((arg) => eb.val(arg))).as("user")),
    ),
  ).pipe(
    Effect.flatMap((row) =>
      Schema.decodeUnknownEffect(Schema.NullOr(SessionUser))(
        Option.isSome(row) ? row.value.user : null,
      ),
    ),
    Effect.map(Option.fromNullOr),
    Effect.mapError(toOAuthError(failureMessage)),
  );

const exchangeGitHubCode = Effect.fnUntraced(function* (rootUrl: string, code: string) {
  const { clientId, clientSecret } = requireGitHubConfiguration();
  const response = yield* executeGitHubRequest(
    HttpClientRequest.post("https://github.com/login/oauth/access_token").pipe(
      HttpClientRequest.setHeaders({
        Accept: "application/json",
        "User-Agent": "dfg.codes",
      }),
      HttpClientRequest.bodyJson({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: new URL("/api/auth/github/callback", rootUrl).toString(),
      }),
    ),
    "GitHub token exchange failed",
  );

  const payload = yield* readGitHubPayload(
    response,
    GitHubTokenPayload,
    "GitHub token response was invalid",
  );

  if (response.status < 200 || response.status >= 300 || typeof payload.access_token !== "string") {
    return yield* Effect.fail(
      new AuthServiceError({
        reason: "oauth-failed",
        message:
          typeof payload.error_description === "string"
            ? payload.error_description
            : typeof payload.error === "string"
              ? payload.error
            : "GitHub token exchange failed",
      }),
    );
  }

  return payload.access_token;
});

const fetchGitHubUser = Effect.fnUntraced(function* (accessToken: string) {
  const response = yield* executeGitHubRequest(
    Effect.succeed(
      HttpClientRequest.get("https://api.github.com/user").pipe(
        HttpClientRequest.setHeaders({
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "dfg.codes",
        }),
      ),
    ),
    "GitHub user lookup failed",
  );

  const payload = yield* readGitHubPayload(response, GitHubUserPayload, "GitHub user payload was invalid");

  if (
    response.status < 200 ||
    response.status >= 300 ||
    typeof payload.id !== "number" ||
    typeof payload.login !== "string"
  ) {
    return yield* Effect.fail(
      new AuthServiceError({
        reason: "oauth-failed",
        message: typeof payload.message === "string" ? payload.message : "GitHub user lookup failed",
      }),
    );
  }

  return {
    avatar_url: typeof payload.avatar_url === "string" ? payload.avatar_url : null,
    id: String(payload.id),
    login: payload.login,
  } satisfies GitHubUser;
});

export const isGitHubAuthConfigured = () =>
  Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

export const getDiscussionSessionCookie = () => sessionCookieName;

export const getDiscussionSessionCookieOptions = (rootUrl: string) => ({
  expires: new Date(Date.now() + sessionTtlMs),
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: isSecureCookieOrigin(rootUrl),
});

export const getGitHubOAuthStateCookie = () => oauthStateCookieName;

export const getGitHubOAuthStateCookieOptions = (rootUrl: string) => ({
  expires: new Date(Date.now() + oauthStateTtlMs),
  httpOnly: true,
  path: "/api/auth/github",
  sameSite: "lax" as const,
  secure: isSecureCookieOrigin(rootUrl),
});

export const createGitHubAuthorizationRequest = Effect.fnUntraced(function* (
  rootUrl: string,
  redirectTo: string | null | undefined,
) {
  const { clientId } = requireGitHubConfiguration();
  const redirect = normalizeRedirect(redirectTo);

  if (!redirect) {
    return yield* Effect.fail(
      new AuthServiceError({
        reason: "invalid-redirect",
        message: "The OAuth redirect target must stay on this site",
      }),
    );
  }

  const state = randomHex(16);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", new URL("/api/auth/github/callback", rootUrl).toString());
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);

  return {
    stateCookieValue: encodeOAuthState({ redirect, state }),
    url,
  };
});

export const createConfiguredGitHubAuthorizationUrl = Effect.fnUntraced(function* (
  redirectTo: string,
) {
  const rootUrl = configuredRootUrl();

  if (!rootUrl) {
    return yield* Effect.fail(
      new AuthServiceError({
        reason: "oauth-failed",
        message: "VITE_ROOT_URL must be configured for GitHub OAuth",
      }),
    );
  }

  return yield* createGitHubAuthorizationRequest(rootUrl, redirectTo).pipe(
    Effect.map(({ url }) => url),
  );
});

export const completeGitHubAuthorization = Effect.fnUntraced(function* (
  rootUrl: string,
  code: string | null,
  state: string | null,
  stateCookieValue: string | undefined,
) {
  if (!code || !state) {
    return yield* Effect.fail(
      new AuthServiceError({
        reason: "oauth-failed",
        message: "GitHub did not return a complete callback payload",
      }),
    );
  }

  const decodedState = decodeOAuthState(stateCookieValue);

  if (Option.isNone(decodedState) || decodedState.value.state !== state) {
    return yield* Effect.fail(
      new AuthServiceError({
        reason: "oauth-failed",
        message: "The GitHub OAuth state was missing or invalid",
      }),
    );
  }

  const accessToken = yield* exchangeGitHubCode(rootUrl, code);
  const githubUser = yield* fetchGitHubUser(accessToken);
  const { session, token } = yield* signInGitHubUser(githubUser);

  return {
    redirect: decodedState.value.redirect,
    session,
    token,
  };
});

export const validateDiscussionSessionToken = Effect.fnUntraced(function* (
  token: string | undefined,
) {
  const parsed = parseSessionToken(token);

  if (!parsed) {
    return Option.none<ValidatedSession>();
  }

  const user = yield* callSessionUserFunction(
    "auth.find_session",
    [parsed.cookieId, hashSecret(parsed.secret)],
    "Loading the session failed",
  );

  return Option.map(
    user,
    (found): ValidatedSession => ({ cookieId: parsed.cookieId, session: toAuthSession(found) }),
  );
});

export const deleteDiscussionSession = (cookieId: string) =>
  withVisitorRole((db) =>
    executeQuery(
      db.selectNoFrom((eb) => eb.fn<unknown>("auth.sign_out", [eb.val(cookieId)]).as("signed_out")),
    ),
  ).pipe(Effect.asVoid, Effect.mapError(toOAuthError("Deleting the session failed")));
