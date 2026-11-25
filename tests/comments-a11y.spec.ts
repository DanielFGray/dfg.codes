import { expect, test } from "@playwright/test";

// The delete and reply controls are icon-only buttons, so their accessible name comes
// from aria-label. The discussion API is stubbed because the page's own rendering is
// what this test covers: a signed-in visitor's comment shows both controls, and another
// visitor's comment shows only reply.
const SIGNED_IN_USER = {
  user_id: "00000000-0000-4000-8000-000000000001",
  username: "signed-in-visitor",
  avatar_url: "https://example.com/avatar.png",
};

const OTHER_USER = {
  user_id: "00000000-0000-4000-8000-000000000002",
  username: "other-visitor",
  avatar_url: "https://example.com/other.png",
};

const comment = (id: number, user: typeof SIGNED_IN_USER, body: string) => ({
  comment_id: id,
  user,
  body,
  created_at: new Date().toISOString(),
  children: [],
});

test("a comment's icon buttons carry accessible names", async ({ page }) => {
  await page.route("**/api/session", route =>
    route.fulfill({
      json: { authAvailable: true, session: { user: SIGNED_IN_USER } },
    }),
  );
  await page.route("**/api/comments?*", route =>
    route.fulfill({
      json: [
        comment(1, SIGNED_IN_USER, "my own comment"),
        comment(2, OTHER_USER, "someone else's comment"),
      ],
    }),
  );

  await page.goto("/articles/vim-guide");

  // Only the visitor's own comment can be deleted.
  const deleteButtons = page.getByRole("button", { name: /delete/i });
  await expect(deleteButtons).toHaveCount(1);
  await expect(deleteButtons.first()).toHaveAccessibleName(/delete your comment/i);

  // Every comment can be replied to; the name says which visitor wrote it.
  const replyButtons = page.getByRole("button", { name: /reply/i });
  await expect(replyButtons).toHaveCount(2);
  await expect(replyButtons.first()).toHaveAccessibleName(/reply to signed-in-visitor/i);
  await expect(replyButtons.last()).toHaveAccessibleName(/reply to other-visitor/i);
});
