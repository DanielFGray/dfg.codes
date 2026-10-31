import { expect, test } from "@playwright/test";
import crypto from "node:crypto";
import pg from "pg";
import { Schema } from "effect";

import { GitHubTokenPayload, GitHubUserPayload } from "../server/discussion/github-oauth-payload.js";

const env = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }

  return value;
};

const hashSecret = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const randomHex = (bytes: number) => crypto.randomBytes(bytes).toString("hex");

type AuthFixture = {
  readonly dispose: () => Promise<void>;
  readonly token: string;
  readonly userId: string;
  readonly username: string;
};

const discussionSessionHeaders = (token: string) => ({
  Cookie: `discussion_session=${token}`,
});

const createAuthenticatedFixture = async (): Promise<AuthFixture> => {
  const client = new pg.Client({ connectionString: env("DATABASE_URL") });
  await client.connect();

  const username = `rls-${randomHex(6)}`;
  const avatarUrl = "https://example.com/avatar.png";
  const cookieId = randomHex(24);
  const secret = randomHex(32);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  try {
    const userResult = await client.query<{
      avatar_url: string | null;
      user_id: string;
      username: string;
    }>(
      `
        insert into auth.users (username, avatar_url)
        values ($1, $2)
        returning id as user_id, username, avatar_url
      `,
      [username, avatarUrl],
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new Error("Failed to create authenticated test user");
    }

    await client.query(
      `
        insert into hidden.sessions (cookie_id, secret_hash, user_id, expires_at)
        values ($1, $2, $3, $4)
      `,
      [cookieId, hashSecret(secret), user.user_id, expiresAt],
    );

    return {
      dispose: async () => {
        await client.query("delete from hidden.sessions where cookie_id = $1", [cookieId]);
        await client.query("delete from auth.users where id = $1", [user.user_id]);
        await client.end();
      },
      token: `${cookieId}.${secret}`,
      userId: user.user_id,
      username: user.username,
    };
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
};

test("discussion session endpoint returns an anonymous session payload", async ({ request }) => {
  const response = await request.get("/api/session");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    authAvailable: true,
    session: null,
  });
});

test("github auth redirect uses the current request origin", async ({ request, baseURL }) => {
  const response = await request.get("/api/auth/github?redirect=%2F", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);

  const location = response.headers()["location"];
  expect(location).toBeTruthy();

  const redirectUri = new URL(location!).searchParams.get("redirect_uri");
  expect(redirectUri).toBe(new URL("/api/auth/github/callback", baseURL).toString());

  const stateCookie = response.headers()["set-cookie"];
  expect(stateCookie).toContain("discussion_github_oauth=");
  expect(stateCookie).toContain("Path=/api/auth/github");
  expect(stateCookie).not.toContain("Max-Age=0");
});

test("github oauth payload schemas accept token and user responses", () => {
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

test("discussion stats and likes endpoints return shaped payloads", async ({ request }) => {
  const [statsResponse, likesResponse] = await Promise.all([
    request.get("/api/comment-stats"),
    request.get("/api/likes?slug=diy-comments"),
  ]);

  expect(statsResponse.status()).toBe(200);
  expect(await statsResponse.json()).toEqual({
    countsBySlug: {},
  });

  expect(likesResponse.status()).toBe(200);
  expect(await likesResponse.json()).toEqual({
    total: 0,
    available: 10,
    max: 10,
  });
});

test("threaded comments endpoint returns an empty list for posts without comments", async ({
  request,
}) => {
  const response = await request.get(`/api/comments?slug=playwright-empty-${randomHex(6)}`);

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual([]);
});

test("threaded comments endpoint returns a comment list for the diy-comments article", async ({
  request,
}) => {
  const response = await request.get("/api/comments?slug=diy-comments");

  expect(response.status()).toBe(200);
  expect(Array.isArray(await response.json())).toBe(true);
});

test("unknown discussion routes return the dedicated 404 response", async ({ request }) => {
  const response = await request.get("/api/does-not-exist");

  expect(response.status()).toBe(404);
  expect(await response.text()).toBe("Not found");
});

test("sign out succeeds without requiring an absolute request URL", async ({ request }) => {
  const response = await request.post("/api/auth/signout");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
  });
});

test("authenticated comment creation passes RLS with session-derived identity", async ({ request }) => {
  const fixture = await createAuthenticatedFixture();

  try {
    const response = await request.post("/api/comments", {
      data: {
        slug: "diy-comments",
        body: `Session-derived RLS ${randomHex(6)}`,
        parent_id: null,
      },
      headers: {
        Cookie: `discussion_session=${fixture.token}`,
      },
    });

    expect(response.status()).toBe(201);

    const createdComment = await response.json();
    expect(createdComment.user.user_id).toBe(fixture.userId);
    expect(createdComment.user.username).toBe(fixture.username);
  } finally {
    await fixture.dispose();
  }
});

test("liking a post updates the likes payload for that actor", async ({ request }) => {
  const slug = `playwright-like-${randomHex(6)}`;

  const initialResponse = await request.get(`/api/likes?slug=${slug}`);
  expect(initialResponse.status()).toBe(200);
  expect(await initialResponse.json()).toEqual({
    total: 0,
    available: 10,
    max: 10,
  });

  const likeResponse = await request.post("/api/likes", {
    data: {
      post: slug,
      requested_votes: 3,
    },
  });

  expect(likeResponse.status()).toBe(200);
  expect(await likeResponse.json()).toEqual({
    total: 3,
    available: 7,
    max: 10,
  });

  const afterResponse = await request.get(`/api/likes?slug=${slug}`);
  expect(afterResponse.status()).toBe(200);
  expect(await afterResponse.json()).toEqual({
    total: 3,
    available: 7,
    max: 10,
  });
});

test("authenticated comments can be created and then deleted", async ({ request }) => {
  const fixture = await createAuthenticatedFixture();
  const slug = `playwright-comment-${randomHex(6)}`;
  const body = `Playwright comment ${randomHex(6)}`;

  try {
    const createResponse = await request.post("/api/comments", {
      data: {
        slug,
        body,
        parent_id: null,
      },
      headers: discussionSessionHeaders(fixture.token),
    });

    expect(createResponse.status()).toBe(201);

    const createdComment = await createResponse.json();
    expect(createdComment.body).toBe(body);
    expect(createdComment.user.user_id).toBe(fixture.userId);
    expect(createdComment.user.username).toBe(fixture.username);

    const threadAfterCreate = await request.get(`/api/comments?slug=${slug}`, {
      headers: discussionSessionHeaders(fixture.token),
    });
    expect(threadAfterCreate.status()).toBe(200);

    const createdThread = await threadAfterCreate.json();
    expect(createdThread).toEqual([
      expect.objectContaining({
        body,
        comment_id: createdComment.comment_id,
        children: [],
        user: expect.objectContaining({
          user_id: fixture.userId,
          username: fixture.username,
        }),
      }),
    ]);

    const deleteResponse = await request.delete(
      `/api/comments/${createdComment.comment_id}`,
      {
        headers: discussionSessionHeaders(fixture.token),
      },
    );

    expect(deleteResponse.status()).toBe(200);
    expect(await deleteResponse.json()).toEqual({
      success: true,
    });

    const threadAfterDelete = await request.get(`/api/comments?slug=${slug}`, {
      headers: discussionSessionHeaders(fixture.token),
    });
    expect(threadAfterDelete.status()).toBe(200);

    const deletedThread = await threadAfterDelete.json();
    expect(deletedThread).toEqual([
      expect.objectContaining({
        body: "",
        comment_id: createdComment.comment_id,
        children: [],
        user: expect.objectContaining({
          user_id: fixture.userId,
          username: fixture.username,
        }),
      }),
    ]);
  } finally {
    await fixture.dispose();
  }
});
