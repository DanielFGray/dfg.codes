import { describe, expect, it } from "vitest";
import { nameOpacity, sectionAtLine } from "./scroll.js";

describe("nameOpacity", () => {
  it("is opaque at the top of the page", () => {
    expect(nameOpacity(400, 400)).toBe(1);
  });

  it("holds at 1 until the gap falls to half its starting value", () => {
    expect(nameOpacity(200, 400)).toBe(1);
    expect(nameOpacity(199, 400)).toBeLessThan(1);
  });

  it("is 0 once the gap falls to 0.15 of its starting value", () => {
    expect(nameOpacity(60, 400)).toBe(0);
    expect(nameOpacity(0, 400)).toBe(0);
    expect(nameOpacity(-50, 400)).toBe(0);
  });

  it("falls linearly between the two", () => {
    expect(nameOpacity(130, 400)).toBeCloseTo(0.5);
  });

  it("stays opaque when the split screen is taller than the viewport", () => {
    expect(nameOpacity(900, 400)).toBe(1);
  });

  it("stays opaque when there is no starting gap to measure", () => {
    expect(nameOpacity(0, 0)).toBe(1);
  });
});

describe("sectionAtLine", () => {
  const boxes = [
    { route: "/", top: -800, bottom: 100 },
    { route: "/about", top: 100, bottom: 900 },
  ];

  it("picks the section that covers the line", () => {
    expect(sectionAtLine(boxes, 50)).toBe("/");
    expect(sectionAtLine(boxes, 400)).toBe("/about");
  });

  it("treats a section's top edge as inside it and its bottom edge as outside", () => {
    expect(sectionAtLine(boxes, 100)).toBe("/about");
  });

  it("is undefined when no section covers the line", () => {
    expect(sectionAtLine(boxes, 950)).toBeUndefined();
  });
});
