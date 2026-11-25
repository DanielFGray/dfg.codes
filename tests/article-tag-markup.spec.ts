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
