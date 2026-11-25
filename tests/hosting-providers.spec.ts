import { expect, test } from "@playwright/test";

const TABLE = 'table[aria-label="Backend hosting providers"]';
const HEADER = (label: string) => `${TABLE} thead th:has-text("${label}")`;
const PRICES = `${TABLE} tbody td:nth-child(4)`;

const ASCENDING_PRICES = ["$0", "$0", "$0", "$0", "$0", "$0", "$0", "$2.5", "$5", "$5"];
const DESCENDING_PRICES = ["$5", "$5", "$2.5", "$0", "$0", "$0", "$0", "$0", "$0", "$0"];

// The hosting-providers table in the Backend FAQs article sorts its columns.
test("the hosting table exposes aria-sort on every sortable header", async ({ page }) => {
  await page.goto("/articles/backend-faq");

  for (const label of ["platform", "type", "supported backends", "cheapest plans"]) {
    await expect(page.locator(HEADER(label))).toHaveAttribute("aria-sort");
  }
  // The table opens sorted by platform name.
  await expect(page.locator(HEADER("platform"))).toHaveAttribute("aria-sort", "ascending");
});

test("the hosting table sorts cheapest plans in both directions", async ({ page }) => {
  await page.goto("/articles/backend-faq");
  const header = page.locator(HEADER("cheapest plans"));

  await header.click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(page.locator(PRICES)).toHaveText(ASCENDING_PRICES);

  await header.click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(page.locator(PRICES)).toHaveText(DESCENDING_PRICES);
});
