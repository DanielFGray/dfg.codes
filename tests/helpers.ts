import type { Page } from "@playwright/test";

// The index filter's tag rows live in a RAC grid labelled by the "filter by:" label.
export const tagRow = (page: Page, tag: string) =>
  page.getByRole("grid", { name: "filter by:" }).getByRole("row", { name: tag });

// The index page is prerendered, and hydration attaches no selection handler until
// React commits, without replaying an earlier press: a press can land in that window
// and do nothing. Retrying until the URL answers keeps callers deterministic without
// guessing a fixed wait, and doubles as the readiness signal for later keyboard use.
export async function toggleTag(page: Page, tag: string) {
  const row = tagRow(page, tag);
  const before = page.url();
  for (let attempt = 0; attempt < 10; attempt++) {
    await row.click();
    if (
      await page
        .waitForURL((url) => url.toString() !== before, { timeout: 1000 })
        .then(() => true)
        .catch(() => false)
    ) {
      return;
    }
  }
  throw new Error(`pressing the ${tag} tag never changed the URL`);
}
