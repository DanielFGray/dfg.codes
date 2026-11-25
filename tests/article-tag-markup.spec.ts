import { expect, test } from "@playwright/test";

import { toggleTag } from "./helpers";

// A tag pill on a card, the home preview or an article header is a link inside a list
// item. A <li> may not wrap an <a>, and a <ul> may hold nothing but <li>s, so the
// "tagged:" labels sit beside the list. (The index filter is a selection grid, not a
// link list; its behavior is covered in article-tag-filter.spec.ts.)
for (const path of ["/", "/articles", "/articles/vim-guide"]) {
  test(`${path} tag lists hold only list items`, async ({ page }) => {
    await page.goto(path);

    const tagLists = page.locator('ul:has(a[href*="tag="])');
    // On /articles the mobile card tag lists are display-hidden, so at least one
    // matching list must be visible rather than the first one in the document.
    await expect(tagLists.filter({ visible: true }).first()).toBeVisible();

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
// the same line, and later tags wrap underneath. A list that is a lone flex item drops
// the whole list to its own full-width row, leaving the label alone on the first line.
type Box = { x: number; y: number; width: number; height: number };

// Boxes on one flex row overlap vertically; the label's font size may differ from the
// pills', so equal tops would over-specify the layout.
const expectSharesRow = (label: Box, tag: Box) => {
  expect(tag.y).toBeLessThan(label.y + label.height);
  expect(tag.y + tag.height).toBeGreaterThan(label.y);
  expect(tag.x).toBeGreaterThan(label.x + label.width);
};

// Hydration can replace a node mid-measure, and two separate reads can straddle a
// layout change, so the label and every tag are read in one atomic evaluate; a null
// result is a lost race, not a hidden element, and is measured again.
async function measureTagRow(
  page: import("@playwright/test").Page,
  labelText: string,
  tagSelector: string,
): Promise<{ label: Box; tags: Box[] } | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const boxes = await page.evaluate(
      ([labelText, tagSelector]) => {
        const read = (el: Element) => {
          const { x, y, width, height } = el.getBoundingClientRect();
          return { x, y, width, height };
        };
        const label = Array.from(document.querySelectorAll("span")).find(
          (s) => s.textContent?.trim() === labelText,
        );
        const tags = Array.from(document.querySelectorAll(tagSelector));
        if (!label || tags.length === 0) return null;
        return { label: read(label), tags: tags.map(read) };
      },
      [labelText, tagSelector] as const,
    );
    if (boxes) return boxes;
    await page.waitForTimeout(250);
  }
  return null;
}

// The filter's pills follow the "filter by:" label on one wrapping row, like the link
// lists do: the tag grid is display:contents so its rows join the label's flex row
// instead of sitting in it as one flex item that would drop to a full-width row.
test("/articles puts the first tag on the label's row", async ({ page }) => {
  await page.goto("/articles");

  const measured = await measureTagRow(page, "filter by:", '[role="grid"] [role="row"]');
  expect(measured, "label and first tag boxes").not.toBeNull();
  expectSharesRow(measured!.label, measured!.tags[0]!);
});

// An article with enough tags wraps them at phone width. The "tagged:" label keeps the
// first tag on its row, and the list still wraps onto a later row.
test("an article's first tag shares the 'tagged:' row when the tags wrap", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/articles/postgres-auth");

  const measured = await measureTagRow(page, "tagged:", 'ul a[href*="tag="]');
  expect(measured, "label and tag boxes").not.toBeNull();
  expect(measured!.tags.length, "tag count").toBeGreaterThan(1);
  expectSharesRow(measured!.label, measured!.tags[0]!);
  expect(new Set(measured!.tags.map(({ y }) => Math.round(y))).size).toBeGreaterThan(1);
});

// With one tag selected, a tag that appears on no filtered article is dimmed. As a
// selection it must be inert: no tab stop for Tab to land on, and arrow navigation
// inside the grid skips it — otherwise a keyboard user reaches a tag that does
// nothing.
test("a dimmed tag is disabled and skipped by keyboard navigation", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/articles?tag=vim");

  const disabled = page.locator('[role="row"][aria-disabled="true"]');
  await expect(disabled.first()).toBeVisible();

  // The press can land while hydration replaces nodes and the pill has no box yet;
  // retrying keeps the inert-press assertion deterministic.
  for (let attempt = 0; ; attempt++) {
    try {
      await disabled.first().click({ force: true, timeout: 2000 });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  await expect(page).toHaveURL(/\/articles\?tag=vim$/);

  // The tags the vim filter leaves enabled.
  const enabledTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="row"]'))
      .filter((r) => !r.hasAttribute("aria-disabled"))
      .map((r) => r.textContent!),
  );

  // A selection round-trip proves the page answers presses, so the keyboard walk
  // below is not racing hydration.
  await toggleTag(page, enabledTexts[0]!);
  await toggleTag(page, enabledTexts[0]!);

  // Tab reaches the grid at an enabled row: a disabled tag carries no tab stop, so
  // the roving tabindex never offers one to Tab.
  let landedDisabled: boolean | null = null;
  for (let i = 0; i < 100 && landedDisabled === null; i++) {
    await page.keyboard.press("Tab");
    landedDisabled = await page.evaluate(() =>
      document.activeElement?.getAttribute("role") === "row"
        ? document.activeElement!.hasAttribute("aria-disabled")
        : null,
    );
  }
  expect(landedDisabled, "Tab reaches a tag row").not.toBeNull();
  expect(landedDisabled, "the row Tab reaches is enabled").toBe(false);

  // Arrow keys move within the grid and skip the disabled tags.
  const visited = new Set<string>();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute("role") === "row"
        ? document.activeElement!.textContent!
        : null,
    );
    if (focused) visited.add(focused);
  }
  expect(visited.size, "arrows moved within the grid").toBeGreaterThan(0);
  for (const text of visited) {
    expect(enabledTexts, `${text} is enabled`).toContain(text);
  }
});
