import crypto from "node:crypto";

import { Effect, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { AuthSession, AuthServiceError, AuthUser } from "../../src/services/discussion.js";
import { executeQuery, executeTakeFirst, rootDb } from "../db.js";
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

const resolveUniqueUsername = Effect.fnUntraced(function* (login: string) {
  const base = normalizeGitHubUsername(login);

  for (let index = 0; ; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`;
    const existing = yield* executeTakeFirst(
      rootDb.selectFrom("auth.users").select("id").where("username", "=", candidate).limit(1),
    );

    if (Option.isNone(existing)) {
      return candidate;
    }
  }
});

const createSessionRow = Effect.fnUntraced(function* (userId: string) {
  const cookieId = randomHex(24);
  const secret = randomHex(32);
  const expiresAt = new Date(Date.now() + sessionTtlMs);

  yield* executeQuery(
    rootDb.insertInto("hidden.sessions").values({
      cookie_id: cookieId,
      expires_at: expiresAt,
      secret_hash: hashSecret(secret),
      user_id: userId,
    }),
  );

  return {
    expiresAt,
    token: `${cookieId}.${secret}`,
  };
});

const findOrCreateGitHubUser = Effect.fnUntraced(function* (githubUser: GitHubUser) {
  const existingUser = yield* executeTakeFirst(
    rootDb
      .selectFrom("auth.oauth_accounts as oauth")
      .innerJoin("auth.users as users", "users.id", "oauth.user_id")
      .select(["users.id as user_id", "users.username", "users.avatar_url"])
      .where("oauth.provider", "=", "github")
      .where("oauth.provider_user_id", "=", githubUser.id)
      .limit(1),
  );

  if (Option.isSome(existingUser)) {
    return toAuthSession(existingUser.value);
  }

  const username = yield* resolveUniqueUsername(githubUser.login);
  const createdUser = yield* executeTakeFirst(
    rootDb
      .insertInto("auth.users")
      .values({
        avatar_url: githubUser.avatar_url,
        username,
      })
      .returning(["id as user_id", "username", "avatar_url"]),
  );

  if (Option.isNone(createdUser)) {
    return yield* Effect.fail(
      new AuthServiceError({
        reason: "oauth-failed",
        message: "GitHub authentication did not create a user",
      }),
    );
  }

  yield* executeQuery(
    rootDb.insertInto("auth.oauth_accounts").values({
      provider: "github",
      provider_user_id: githubUser.id,
      user_id: createdUser.value.user_id,
    }),
  );

  return toAuthSession(createdUser.value);
});

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

export const createDiscussionSession = Effect.fnUntraced(function* (userId: string) {
  return yield* createSessionRow(userId).pipe(
    Effect.mapError(
      (error) =>
        new AuthServiceError({
          reason: "oauth-failed",
          message: error instanceof Error ? error.message : "Creating the session failed",
        }),
    ),
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
  const session = yield* findOrCreateGitHubUser(githubUser).pipe(
    Effect.mapError((error) =>
      error instanceof AuthServiceError
        ? error
        : new AuthServiceError({
            reason: "oauth-failed",
            message: error instanceof Error ? error.message : "Creating the GitHub user failed",
          }),
    ),
  );
  const persistedSession = yield* createDiscussionSession(session.user.user_id);

  return {
    redirect: decodedState.value.redirect,
    session,
    token: persistedSession.token,
  };
});

export const validateDiscussionSessionToken = Effect.fnUntraced(function* (
  token: string | undefined,
) {
  const parsed = parseSessionToken(token);

  if (!parsed) {
    return Option.none<ValidatedSession>();
  }

  const row = yield* executeTakeFirst(
    rootDb
      .selectFrom("hidden.sessions as sessions")
      .innerJoin("auth.users as users", "users.id", "sessions.user_id")
      .select([
        "sessions.cookie_id",
        "sessions.expires_at",
        "sessions.secret_hash",
        "users.id as user_id",
        "users.username",
        "users.avatar_url",
      ])
      .where("sessions.cookie_id", "=", parsed.cookieId)
      .limit(1),
  ).pipe(
    Effect.mapError(
      (error) =>
        new AuthServiceError({
          reason: "oauth-failed",
          message: error instanceof Error ? error.message : "Loading the session failed",
        }),
    ),
  );

  if (Option.isNone(row) || row.value.expires_at <= new Date()) {
    return Option.none<ValidatedSession>();
  }

  const candidate = Buffer.from(hashSecret(parsed.secret), "hex");
  const stored = Buffer.from(row.value.secret_hash, "hex");

  if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) {
    return Option.none<ValidatedSession>();
  }

  return Option.some({
    cookieId: row.value.cookie_id,
    session: toAuthSession(row.value),
  });
});

export const deleteDiscussionSession = Effect.fnUntraced(function* (cookieId: string) {
  yield* executeQuery(rootDb.deleteFrom("hidden.sessions").where("cookie_id", "=", cookieId)).pipe(
    Effect.map(() => undefined),
    Effect.mapError(
      (error) =>
        new AuthServiceError({
          reason: "oauth-failed",
          message: error instanceof Error ? error.message : "Deleting the session failed",
        }),
    ),
  );
});
