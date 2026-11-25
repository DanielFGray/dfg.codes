import { expect, test, type Page } from "@playwright/test";

// The WebContainer preview's terminal toggle and resize handle used to be
// mouse-only divs (onClick and onMouseDown). These tests walk the real article
// page and prove the keyboard paths: the toggle is a button with a disclosure
// state, and the resize handle is a focusable separator that both the pointer
// and the arrow keys move.
const ARTICLE = "/articles/why-react";

async function openPreview(page: Page) {
  await page.goto(ARTICLE);
  const run = page.getByRole("button", { name: "Run" });
  const toggle = page.getByRole("button", { name: "Terminal" });
  // The editor auto-runs when it is the most visible one on the page, so Run
  // may already be gone; a press that races that auto-run is harmless.
  await run.or(toggle).waitFor();
  try {
    await run.click({ timeout: 1_000 });
  } catch {
    // auto-run beat the click; the preview chrome is already up
  }
  await toggle.waitFor();
  return toggle;
}

test("the terminal toggle is a keyboard-operable button", async ({ page }) => {
  const toggle = await openPreview(page);
  expect(await toggle.evaluate(el => el.tagName)).toBe("BUTTON");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("separator", { name: "Resize terminal" })).toBeHidden();

  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("separator", { name: "Resize terminal" })).toBeVisible();
});

test("the terminal resize handle is a focusable separator the keyboard can move", async ({ page }) => {
  await openPreview(page);

  const handle = page.getByRole("separator", { name: "Resize terminal" });
  await expect(handle).toHaveAttribute("tabindex", "0");
  // The toggle's aria-controls names the terminal panel it discloses.
  const panelId = await page
    .getByRole("button", { name: "Terminal" })
    .getAttribute("aria-controls");
  expect(panelId, "the toggle declares which panel it controls").not.toBeNull();
  const terminal = page.locator(`#${panelId}`);
  const terminalHeight = () => terminal.evaluate(el => el.getBoundingClientRect().height);

  // The handle sits on top of the terminal, so it must follow the pointer:
  // dragging up moves the separator up and makes the terminal taller.
  const preDrag = await terminalHeight();
  const box = await handle.boundingBox();
  expect(box, "the resize handle has a bounding box").not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 - 60, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await handle.boundingBox())!.y).toBeLessThan(box!.y - 50);
  await expect.poll(terminalHeight).toBeGreaterThan(preDrag);

  // Arrow keys move the separator: ArrowUp up (terminal taller), ArrowDown
  // down (shorter).
  await handle.focus();
  const draggedY = (await handle.boundingBox())!.y;
  const grown = await terminalHeight();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await handle.boundingBox())!.y).toBeLessThan(draggedY);
  await expect.poll(terminalHeight).toBeGreaterThan(grown);
  const liftedY = (await handle.boundingBox())!.y;
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowDown");
  await expect.poll(async () => (await handle.boundingBox())!.y).toBeGreaterThan(liftedY);

  // The separator's declared value range is true: aria-valuemax is present
  // and not below the value it reports.
  const [now, max] = await Promise.all([
    handle.getAttribute("aria-valuenow"),
    handle.getAttribute("aria-valuemax"),
  ]);
  expect(max, "the separator declares an upper bound").not.toBeNull();
  expect(Number(max!)).toBeGreaterThanOrEqual(Number(now!));
});
