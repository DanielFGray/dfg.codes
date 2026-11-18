import { expect, layer } from "@effect/vitest";
import crypto from "node:crypto";
import pg from "pg";
import { Effect } from "effect";
import { type HttpClient, HttpClientRequest } from "effect/http";

import { newSession, serverOrigin, TestApi } from "./apiHarness.js";

const randomHex = (bytes: number) => crypto.randomBytes(bytes).toString("hex");

interface Reply {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

/** Sends one request and reads the body as JSON when it parses, else as text. */
const send = (
  http: HttpClient.HttpClient,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) =>
  Effect.gen(function* () {
    const base = HttpClientRequest.make(method)(path);
    const withBody = body === undefined ? base : HttpClientRequest.bodyJsonUnsafe(body)(base);
    const request = headers ? HttpClientRequest.setHeaders(withBody, headers) : withBody;
    const res = yield* http.execute(request);
    const text = yield* res.text;
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Not JSON: the body stays as text, e.g. the 404 page.
    }
    return { status: res.status, headers: res.headers, body: parsed } satisfies Reply;
  });

/**
 * A user and a session row written straight to the test database, so a test can act
 * as a signed-in user. `dispose` removes both.
 */
const createAuthenticatedFixture = Effect.acquireRelease(
  Effect.tryPromise(async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const username = `itest-${randomHex(6)}`;
    const cookieId = randomHex(24);
    const secret = randomHex(32);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const { rows } = await client.query<{ user_id: string; username: string }>(
      `insert into auth.users (username, avatar_url)
       values ($1, $2)
       returning id as user_id, username`,
      [username, "https://example.com/avatar.png"],
    );
    const user = rows[0];
    if (!user) throw new Error("Failed to create authenticated test user");
    await client.query(
      `insert into hidden.sessions (cookie_id, secret_hash, user_id, expires_at)
       values ($1, $2, $3, $4)`,
      [cookieId, crypto.createHash("sha256").update(secret).digest("hex"), user.user_id, expiresAt],
    );
    return {
      client,
      token: `${cookieId}.${secret}`,
      userId: user.user_id,
      username: user.username,
    };
  }),
  ({ client, userId }) =>
    Effect.promise(async () => {
      await client.query("delete from hidden.sessions where user_id = $1", [userId]);
      await client.query("delete from auth.users where id = $1", [userId]);
      await client.end();
    }),
);

const sessionHeaders = (token: string) => ({ Cookie: `discussion_session=${token}` });

layer(TestApi)("discussion API", (it) => {
  it.effect("the session endpoint returns an anonymous session payload", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const reply = yield* send(http, "GET", "/api/session");

      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({ authAvailable: true, session: null });
    }),
  );

  it.effect("the GitHub auth redirect uses the request's origin", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const origin = yield* serverOrigin;
      const reply = yield* send(http, "GET", "/api/auth/github?redirect=%2F");

      expect(reply.status).toBe(302);

      const location = reply.headers["location"];
      expect(location).toBeTruthy();
      const redirectUri = new URL(location!).searchParams.get("redirect_uri");
      expect(redirectUri).toBe(`${origin}/api/auth/github/callback`);

      const stateCookie = reply.headers["set-cookie"];
      expect(stateCookie).toContain("discussion_github_oauth=");
      expect(stateCookie).toContain("Path=/api/auth/github");
      expect(stateCookie).not.toContain("Max-Age=0");
    }),
  );

  it.effect("the comment stats count a new comment under its slug", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const fixture = yield* createAuthenticatedFixture;
      const slug = `itest-stats-${randomHex(6)}`;

      const created = yield* send(
        http,
        "POST",
        "/api/comments",
        { slug, body: `Stats ${randomHex(6)}`, parent_id: null },
        sessionHeaders(fixture.token),
      );
      expect(created.status).toBe(201);

      const stats = yield* send(http, "GET", "/api/comment-stats");
      expect(stats.status).toBe(200);
      expect(stats.body).toEqual({ countsBySlug: expect.objectContaining({ [slug]: 1 }) });
    }).pipe(Effect.scoped),
  );

  it.effect("likes start at the full allowance for a post with no likes", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const slug = `itest-like-empty-${randomHex(6)}`;

      const reply = yield* send(http, "GET", `/api/likes?slug=${slug}`);
      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({ total: 0, available: 10, max: 10 });
    }),
  );

  it.effect("liking a post updates the likes payload for that visitor", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const slug = `itest-like-${randomHex(6)}`;

      const liked = yield* send(http, "POST", "/api/likes", {
        post: slug,
        requested_votes: 3,
      });
      expect(liked.status).toBe(200);
      expect(liked.body).toEqual({ total: 3, available: 7, max: 10 });

      const after = yield* send(http, "GET", `/api/likes?slug=${slug}`);
      expect(after.body).toEqual({ total: 3, available: 7, max: 10 });
    }),
  );

  it.effect("threaded comments return an empty list for a post without comments", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const reply = yield* send(http, "GET", `/api/comments?slug=itest-empty-${randomHex(6)}`);

      expect(reply.status).toBe(200);
      expect(reply.body).toEqual([]);
    }),
  );

  it.effect("unknown /api routes return the dedicated 404 response", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const reply = yield* send(http, "GET", "/api/does-not-exist");

      expect(reply.status).toBe(404);
      expect(reply.body).toBe("Not found");
    }),
  );

  it.effect("sign out succeeds without an absolute request URL", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const reply = yield* send(http, "POST", "/api/auth/signout");

      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({ success: true });
    }),
  );

  it.effect("a signed-in comment passes RLS with the session's identity", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const fixture = yield* createAuthenticatedFixture;

      const reply = yield* send(
        http,
        "POST",
        "/api/comments",
        { slug: `itest-rls-${randomHex(6)}`, body: `RLS ${randomHex(6)}`, parent_id: null },
        sessionHeaders(fixture.token),
      );

      expect(reply.status).toBe(201);
      expect(reply.body).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({
            user_id: fixture.userId,
            username: fixture.username,
          }),
        }),
      );
    }).pipe(Effect.scoped),
  );

  it.effect("a signed-in comment can be created, read back and deleted", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const fixture = yield* createAuthenticatedFixture;
      const slug = `itest-comment-${randomHex(6)}`;
      const body = `Comment ${randomHex(6)}`;
      const headers = sessionHeaders(fixture.token);

      const created = yield* send(
        http,
        "POST",
        "/api/comments",
        { slug, body, parent_id: null },
        headers,
      );
      expect(created.status).toBe(201);
      const comment = created.body as { comment_id: string };

      const thread = yield* send(http, "GET", `/api/comments?slug=${slug}`, undefined, headers);
      expect(thread.body).toEqual([
        expect.objectContaining({
          body,
          comment_id: comment.comment_id,
          children: [],
          user: expect.objectContaining({
            user_id: fixture.userId,
            username: fixture.username,
          }),
        }),
      ]);

      const deleted = yield* send(
        http,
        "DELETE",
        `/api/comments/${comment.comment_id}`,
        undefined,
        headers,
      );
      expect(deleted.status).toBe(200);
      expect(deleted.body).toEqual({ success: true });

      const afterDelete = yield* send(
        http,
        "GET",
        `/api/comments?slug=${slug}`,
        undefined,
        headers,
      );
      expect(afterDelete.body).toEqual([
        expect.objectContaining({
          body: "",
          comment_id: comment.comment_id,
          children: [],
        }),
      ]);
    }).pipe(Effect.scoped),
  );

  it.effect("a comment without a session is refused as Unauthorized", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const reply = yield* send(http, "POST", "/api/comments", {
        slug: `itest-anon-${randomHex(6)}`,
        body: "no session",
        parent_id: null,
      });

      expect(reply.status).toBe(401);
      expect(reply.body).toEqual({
        _tag: "Unauthorized",
        message: "A signed-in session is required",
      });
    }),
  );

  it.effect("a request that fails its schema is refused as InvalidOperation", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const reply = yield* send(http, "POST", "/api/likes", { post: "x" });

      expect(reply.status).toBe(400);
      expect(reply.body).toEqual(
        expect.objectContaining({ _tag: "InvalidOperation", reason: "invalid_input" }),
      );
    }),
  );

  it.effect("a reply to a missing comment is refused as ParentCommentNotFound", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const fixture = yield* createAuthenticatedFixture;
      const reply = yield* send(
        http,
        "POST",
        "/api/comments",
        { slug: `itest-orphan-${randomHex(6)}`, body: "orphan", parent_id: 2_000_000_000 },
        sessionHeaders(fixture.token),
      );

      expect(reply.status).toBe(404);
      expect(reply.body).toEqual({
        _tag: "ParentCommentNotFound",
        message: "The parent comment does not exist",
      });
    }).pipe(Effect.scoped),
  );

  it.effect("deleting a missing comment is refused as CommentNotFound", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const fixture = yield* createAuthenticatedFixture;
      const reply = yield* send(
        http,
        "DELETE",
        "/api/comments/2000000000",
        undefined,
        sessionHeaders(fixture.token),
      );

      expect(reply.status).toBe(404);
      expect(reply.body).toEqual({
        _tag: "CommentNotFound",
        message: "The comment does not exist",
      });
    }).pipe(Effect.scoped),
  );

  it.effect("a vote count outside 0 to 10 is refused as InvalidVoteCount", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const reply = yield* send(http, "POST", "/api/likes", {
        post: `itest-votes-${randomHex(6)}`,
        requested_votes: 11,
      });

      expect(reply.status).toBe(400);
      expect(reply.body).toEqual({
        _tag: "InvalidVoteCount",
        message: "Votes must stay between 0 and 10",
      });
    }),
  );

  it.effect("a refused database call that no service maps answers fixed text", () =>
    Effect.gen(function* () {
      const http = yield* newSession;
      const fixture = yield* createAuthenticatedFixture;
      // An empty body breaks the comments table's length check (23514), which the
      // answer table words without the database's own message.
      const reply = yield* send(
        http,
        "POST",
        "/api/comments",
        { slug: `itest-check-${randomHex(6)}`, body: "", parent_id: null },
        sessionHeaders(fixture.token),
      );

      expect(reply.status).toBe(400);
      expect(reply.body).toEqual({
        _tag: "InvalidOperation",
        message: "Some values are not valid.",
        reason: "invalid_input",
        issues: [],
      });
    }).pipe(Effect.scoped),
  );
});
