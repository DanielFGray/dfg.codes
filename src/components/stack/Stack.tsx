import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { ArticleMeta } from "#src/lib/articles.js";
import type { Project } from "#src/services/projects.js";
import { SplitScreen } from "./SplitScreen.js";
import { About, Blog, Projects, Uses } from "./RailSections.js";
import { nameOpacity, scrollOnClick, sectionAtLine } from "./scroll.js";
import { sections, type SectionRoute } from "./sections.js";

export type StackData = {
  articles: readonly ArticleMeta[];
  tags: readonly string[];
  /** Null when GitHub could not answer and there is no list to show. */
  projects: readonly Project[] | null;
};

/** How long the scroll must be still before the URL follows it. */
const SETTLE_MS = 120;

/**
 * The home page: a split screen, then About, Projects, Uses and Blog. Every section route
 * renders this same page; `start` only says which section the page opens at. The document
 * scrolls, and the address bar follows it (see `useStackScroll`).
 */
export function Stack({ start, data }: { start: SectionRoute; data: StackData }) {
  const splitRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const { current, goTo } = useStackScroll(start);
  useFadingName(splitRef, nameRef);

  return (
    // self-start: the root layout's body is a flex row of viewport height, which would
    // otherwise stretch this box (and its background) to one screen.
    <div className="w-full self-start bg-stack-bg text-stack-text">
      <SplitScreen ref={splitRef} goTo={goTo} />
      <About />
      <Projects projects={data.projects} />
      <Uses />
      <Blog articles={data.articles} tags={data.tags} />
      <FadingName ref={nameRef} />
      <SectionNav current={current} goTo={goTo} />
    </div>
  );
}

function FadingName({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed top-1/2 left-1/2 z-40 -translate-x-1/2 -translate-y-1/2 mix-blend-difference"
    >
      <h1 className="text-[clamp(1.5rem,4vw,3rem)] font-light tracking-[0.1em] whitespace-nowrap text-white uppercase">
        Daniel F. Gray
      </h1>
    </div>
  );
}

function SectionNav({
  current,
  goTo,
}: {
  current: SectionRoute;
  goTo: (route: SectionRoute) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="fixed top-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] gap-3 rounded bg-stack-nav-bg px-3 py-1.5 text-[0.7rem] font-medium tracking-[0.14em] uppercase backdrop-blur sm:gap-4"
    >
      {sections.map((s) => (
        <a
          key={s.id}
          href={s.route}
          aria-current={s.route === current ? "true" : undefined}
          onClick={scrollOnClick(goTo, s.route)}
          className={clsx(
            "hover:text-stack-accent",
            s.route === current ? "text-stack-strong" : "text-stack-muted",
          )}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

/**
 * Scroll and the address bar.
 *
 * On mount the page scrolls to the section its route names (unless the browser already
 * restored a scroll position). As the visitor scrolls, the URL is replaced with the route
 * of the section under the middle of the screen once the scroll has been still for
 * SETTLE_MS, so a fast flick through three sections rewrites the URL once.
 *
 * The URL is replaced, never pushed: a push would put one history entry per section in
 * the Back button. The router's own `history.state` is kept so its scroll restoration
 * still finds this entry.
 */
function useStackScroll(start: SectionRoute) {
  const [current, setCurrent] = useState<SectionRoute>(start);
  const currentRef = useRef<SectionRoute>(start);

  const commit = (route: SectionRoute) => {
    if (route === currentRef.current) return;
    currentRef.current = route;
    setCurrent(route);
    window.history.replaceState(window.history.state, "", route);
  };

  const goTo = (route: SectionRoute) => {
    const section = sections.find((s) => s.route === route);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(section?.id ?? "")
      ?.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "start" });
    commit(route);
  };

  // The effect reads `commit` and `goTo` from the render it ran in; both only touch refs
  // and setters, which are stable, so it does not need to re-run when they change.
  useEffect(() => {
    if (window.scrollY === 0 && start !== "/") {
      document.getElementById(sections.find((s) => s.route === start)?.id ?? "")?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      const boxes = sections.map((s) => {
        const rect = document.getElementById(s.id)?.getBoundingClientRect();
        return { route: s.route, top: rect?.top ?? 0, bottom: rect?.bottom ?? 0 };
      });
      const route = sectionAtLine(boxes, window.innerHeight / 2);
      if (route) commit(route as SectionRoute);
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [start]);

  return { current, goTo };
}

/** Writes the name's opacity from the split screen's position, once per frame at most. */
function useFadingName(
  splitRef: React.RefObject<HTMLElement | null>,
  nameRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    let frame = 0;
    const fade = () => {
      frame = 0;
      const split = splitRef.current;
      const name = nameRef.current;
      if (!split || !name) return;
      const gap = split.getBoundingClientRect().bottom - name.getBoundingClientRect().bottom;
      const startGap = (window.innerHeight - name.offsetHeight) / 2;
      const opacity = nameOpacity(gap, startGap);
      name.style.opacity = String(opacity);
      // Hidden, not just transparent, so a screen reader skips it once it has faded.
      name.style.visibility = opacity === 0 ? "hidden" : "";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(fade);
    };
    fade();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [splitRef, nameRef]);
}
