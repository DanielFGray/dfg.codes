// Pure rules for the home stack's scroll behaviour. `Stack.tsx` measures the page and
// feeds the numbers in; nothing here touches the DOM.

import type { SectionRoute } from "./sections.js";

/** The name stays opaque until the gap is this fraction of its starting value... */
const FADE_FROM = 0.5;
/** ...and is gone at this fraction. The margin keeps it off the section below. */
const FADE_TO = 0.15;

/**
 * The name's opacity as the split screen scrolls away.
 *
 * The name is fixed at the centre of the screen; the split screen's bottom edge rises
 * towards it. `gap` is the distance from that edge down to the name's bottom edge, and
 * `startGap` is the gap at the top of the page, when the name is centred on a split
 * screen one viewport tall.
 */
export function nameOpacity(gap: number, startGap: number): number {
  if (startGap <= 0) return 1;
  const progress = (gap / startGap - FADE_TO) / (FADE_FROM - FADE_TO);
  return Math.min(1, Math.max(0, progress));
}

export type SectionBox = { route: string; top: number; bottom: number };

/** The route of the section that covers `line` (a viewport y), or undefined between sections. */
export function sectionAtLine(boxes: readonly SectionBox[], line: number): string | undefined {
  return boxes.find((box) => box.top <= line && box.bottom > line)?.route;
}

/**
 * A click handler for a link to a section route. A plain click scrolls the page to the
 * section instead of navigating, because every section route renders the same page. A
 * modified click (new tab, new window) is left to the browser.
 */
export function scrollOnClick(goTo: (route: SectionRoute) => void, route: SectionRoute) {
  return (event: {
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    preventDefault: () => void;
  }) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    goTo(route);
  };
}
