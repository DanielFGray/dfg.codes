import { expect, test } from "@playwright/test";

// A tag pill is a link inside a list item. A <li> may not wrap an <a>, and a <ul> may
// hold nothing but <li>s, so the "filter by:" / "tagged:" labels sit beside the list.
// These are the pages that show a tag list: the index filter, the home preview and an
// article header.
for (const path of ["/", "/articles", "/articles/vim-guide"]) {
  test(`${path} tag lists hold only list items`, async ({ page }) => {
    await page.goto(path);

    const tagLists = page.locator('ul:has(a[href*="tag="])');
    await expect(tagLists.first()).toBeVisible();

    const strayChildren = await tagLists.evaluateAll((lists) =>
      lists.flatMap((list) =>
        Array.from(list.children)
          .filter((child) => child.tagName !== "LI")
          .map((child) => `${list.className || "(no class)"} > ${child.tagName}`),
      ),
    );
    expect(strayChildren).toEqual([]);
    expect(await page.locator("a li").count()).toBe(0);
  });
}

// The label and the pills share one wrapping row: the first tag follows the label on
// the same line, and later tags wrap underneath. A <ul> that is a lone flex item drops
// the whole list to its own full-width row, leaving the label alone on the first line.
type Box = { x: number; y: number; width: number; height: number };

// Boxes on one flex row overlap vertically; the label's font size may differ from the
// pills', so equal tops would over-specify the layout.
const expectSharesRow = (label: Box, tag: Box) => {
  expect(tag.y).toBeLessThan(label.y + label.height);
  expect(tag.y + tag.height).toBeGreaterThan(label.y);
  expect(tag.x).toBeGreaterThan(label.x + label.width);
};

test("/articles puts the first tag on the label's row", async ({ page }) => {
  await page.goto("/articles");

  const labelBox = await page.locator("span", { hasText: "filter by:" }).boundingBox();
  const firstTagBox = await page.locator('ul a[href*="tag="]').first().boundingBox();
  expect(labelBox, "label box").not.toBeNull();
  expect(firstTagBox, "first tag box").not.toBeNull();
  expectSharesRow(labelBox!, firstTagBox!);
});

// An article with enough tags wraps them at phone width. The "tagged:" label keeps the
// first tag on its row, and the list still wraps onto a later row.
test("an article's first tag shares the 'tagged:' row when the tags wrap", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/articles/postgres-auth");

  const labelBox = await page.locator("span", { hasText: "tagged:" }).boundingBox();
  const tagBoxes = await page.locator('ul a[href*="tag="]').evaluateAll((links) =>
    links.map((link) => {
      const { x, y, width, height } = link.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
  expect(labelBox, "label box").not.toBeNull();
  expect(tagBoxes.length, "tag count").toBeGreaterThan(1);
  expectSharesRow(labelBox!, tagBoxes[0]!);
  expect(new Set(tagBoxes.map(({ y }) => Math.round(y))).size).toBeGreaterThan(1);
});

// With one tag selected, a tag that appears on no filtered article is dimmed. It must
// also leave the tab order; otherwise a keyboard reader lands on a link that does nothing.
test("a dimmed tag is disabled and skipped by Tab", async ({ page }) => {
  await page.goto("/articles?tag=vim");

  const dimmed = page.locator('ul a[aria-disabled="true"]');
  await expect(dimmed.first()).toBeVisible();
  await expect(dimmed.first()).toHaveAttribute("tabindex", "-1");
  const dimmedHref = await dimmed.first().evaluate((link) => (link as HTMLAnchorElement).href);

  const tabbed: string[] = [];
  for (let i = 0; i < 250; i++) {
    await page.keyboard.press("Tab");
    const href = await page.evaluate(
      () => (document.activeElement as HTMLAnchorElement | null)?.href ?? null,
    );
    if (href === null || tabbed.includes(href)) continue;
    tabbed.push(href);
  }

  // The walk finds the enabled tag links, so a dimmed href that never appears was skipped.
  expect(tabbed.some((href) => href.includes("?tag="))).toBe(true);
  expect(tabbed).not.toContain(dimmedHref);
});
