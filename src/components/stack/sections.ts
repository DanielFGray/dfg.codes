/**
 * The home stack's sections, in page order. Each section has its own route: the route
 * decides which section the page starts at, and scrolling rewrites the URL to match.
 */
export const sections = [
  { id: "start", route: "/", label: "Start" },
  { id: "about", route: "/about", label: "About" },
  { id: "projects", route: "/projects", label: "Projects" },
  { id: "uses", route: "/uses", label: "Uses" },
  { id: "blog", route: "/blog", label: "Blog" },
] as const;

export type SectionRoute = (typeof sections)[number]["route"];
