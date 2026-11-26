import { scrollOnClick } from "./scroll.js";
import type { SectionRoute } from "./sections.js";

/** The opening screen: music on one half, code on the other. The name sits over the seam. */
export function SplitScreen({
  ref,
  goTo,
}: {
  ref: React.Ref<HTMLElement>;
  goTo: (route: SectionRoute) => void;
}) {
  return (
    <section id="start" ref={ref} className="flex min-h-dvh flex-col md:flex-row">
      <div className="flex min-h-[50dvh] flex-1 flex-col items-center justify-center bg-music-bg px-8 py-12 text-center text-music-text">
        <p className="mb-4 text-xl font-semibold text-music-accent md:text-2xl">I teach music</p>
        <p className="mb-6 max-w-[28ch] text-music-muted">
          Private instruction in drums, guitar, bass, and piano. All ages and skill levels welcome.
        </p>
        <a
          className="rounded bg-music-accent px-7 py-2.5 text-sm font-medium text-music-bg"
          href="https://dfg.rocks"
        >
          dfg.rocks
        </a>
      </div>
      <div className="flex min-h-[50dvh] flex-1 flex-col items-center justify-center bg-code-bg px-8 py-12 text-center font-mono text-code-text">
        <p className="mb-4 text-xl font-semibold text-code-accent md:text-2xl">I write code</p>
        <p className="mb-6 max-w-[28ch] text-code-muted">
          Full-stack developer. TypeScript, React, Node, PostgreSQL, and Linux.
        </p>
        <a
          className="rounded bg-code-accent px-7 py-2.5 font-sans text-sm font-medium text-white"
          href="/blog"
          onClick={scrollOnClick(goTo, "/blog")}
        >
          Read the blog
        </a>
      </div>
    </section>
  );
}
