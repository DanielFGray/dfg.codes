import { expect, test } from "@playwright/test";

// The one browser test: a page that embeds a gigbag.js score draws it. The score is in
// src/content/rudimental-permutations.mdx and is rendered by AlphaTexNotation.
test("an article's AlphaTex score is drawn with no console error", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/articles/rudimental-permutations");

  const score = page.locator(".alphatab-container .at-surface svg").first();
  await expect(score).toBeVisible();
  const box = await score.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  expect(box?.height ?? 0).toBeGreaterThan(0);

  expect(errors).toEqual([]);
});
