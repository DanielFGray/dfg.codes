import { expect, test } from "@playwright/test";

import { tagRow, toggleTag } from "./helpers";

// The index filter is a RAC TagGroup in multiple selection mode: a tag toggles its
// membership in the ?tag= search params, the article list ANDs the selected tags, and
// tags that would match no article are disabled (covered in article-tag-markup.spec.ts).

test("selecting and clearing tags updates ?tag= and the filtered list", async ({ page }) => {
  await page.goto("/articles");
  const cards = page.locator("main article");
  const unfiltered = await cards.count();

  // One tag narrows the list and is marked selected. aria-selected only appears in
  // the commit that also applies the filter, so reading the card count after it is
  // stable.
  await toggleTag(page, "vim");
  await expect(page).toHaveURL(/\/articles\?tag=vim$/);
  await expect(tagRow(page, "vim")).toHaveAttribute("aria-selected", "true");
  const withVim = await cards.count();
  expect(withVim).toBeLessThan(unfiltered);

  // A second tag ANDs into the intersection.
  await toggleTag(page, "unfinished");
  await expect(page).toHaveURL(/tag=unfinished/);
  await expect(tagRow(page, "unfinished")).toHaveAttribute("aria-selected", "true");
  await expect(cards).toHaveCount(1);

  // Clearing the tags one by one walks the filter back to the unfiltered list.
  await toggleTag(page, "unfinished");
  await expect(cards).toHaveCount(withVim);
  await toggleTag(page, "vim");
  await expect(page).toHaveURL(/\/articles$/);
  await expect(cards).toHaveCount(unfiltered);
});

test("a tag toggles selection from the keyboard", async ({ page }) => {
  await page.goto("/articles");
  const row = tagRow(page, "vim");

  // The first press can fall in the hydration window; retry until the URL answers.
  for (let attempt = 0; attempt < 10; attempt++) {
    await row.focus();
    await page.keyboard.press("Space");
    if (
      await page
        .waitForURL(/tag=vim/, { timeout: 1000 })
        .then(() => true)
        .catch(() => false)
    ) {
      break;
    }
  }
  await expect(page).toHaveURL(/\/articles\?tag=vim$/);
  await expect(row).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/\/articles$/);
  await expect(row).not.toHaveAttribute("aria-selected", "true");
});

test("an empty intersection leaves the filter usable", async ({ page }) => {
  await page.goto("/articles?tag=vim&tag=nonexistent-tag-xyz");
  const cards = page.locator("main article");

  // The selection matches no article: nothing may be disabled, or the user could
  // not undo the very selection that emptied the list.
  await expect(page.locator('[role="row"][aria-disabled="true"]')).toHaveCount(0);
  await expect(cards).toHaveCount(0);

  // Deselecting the real tag answers immediately, though the list stays empty
  // while the unknown tag (which has no row in the grid) remains in the URL.
  await toggleTag(page, "vim");
  await expect(page).toHaveURL(/tag=nonexistent-tag-xyz$/);
  await expect(cards).toHaveCount(0);

  // The grid is still live: selecting a real tag updates the URL and the list.
  await toggleTag(page, "react");
  await expect(page).toHaveURL(/tag=react/);
  await expect(cards).toHaveCount(0);
});
