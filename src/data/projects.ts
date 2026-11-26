import type { Category } from "#src/services/projects.js";

/**
 * The projects the site advertises, in display order. This is the selection
 * and the section each one belongs to — the things GitHub cannot answer. The
 * server merges each entry with the cached GitHub data (`gh` repo name →
 * description, stars, language, repo link), and `liveUrl` is the deployed link
 * to advertise when a project has one.
 *
 * `description` is a fallback for entries whose GitHub repo has no description
 * (or has no public repo at all). Once a description exists on GitHub it wins.
 */
export const categories = [
  { id: "apps", label: "Apps" },
  { id: "dev-tools", label: "Dev tools" },
  { id: "agent-tooling", label: "Agent tooling" },
  { id: "sites", label: "Sites" },
] as const satisfies ReadonlyArray<{ id: Category; label: string }>;

export type ProjectEntry = {
  /** Display name, and the GitHub repo name unless `gh` says otherwise. */
  name: string;
  category: Category;
  /** GitHub repo name under DanielFGray when it differs from `name`. */
  gh?: string;
  /** Deployed URL, for a project that is live. */
  liveUrl?: string;
  /** Description fallback (see the doc comment above). */
  description?: string;
};

export const projects: readonly ProjectEntry[] = [
  {
    name: "giglist",
    category: "apps",
    liveUrl: "https://giglist.dfg.rocks",
    description: "Collaborative setlists, gigs, and charts for bands — scores, tabs, and chord charts built on alphaTab.",
  },
  {
    name: "tavern",
    category: "apps",
    liveUrl: "https://tavern.danielfgray.com",
    description: "A voice-and-video hangout, built with Elixir and Cloudflare Realtime.",
  },
  { name: "postgres.garden", category: "apps", liveUrl: "https://postgres.garden" },
  {
    name: "dfg.rocks",
    category: "apps",
    liveUrl: "https://dfg.rocks",
    description: "Music lesson scheduling and billing.",
  },
  { name: "pg-sourcerer", category: "dev-tools", liveUrl: "https://sourcerer.dfg.rocks" },
  { name: "effect-stompbox", category: "dev-tools" },
  {
    name: "roamancer",
    category: "dev-tools",
    description: "A self-hosted deployment platform for shipping apps to NixOS + Nomad.",
  },
  { name: "tsdoctor", category: "dev-tools" },
  {
    name: "pgtap.ts",
    category: "dev-tools",
    description: "Test PostgreSQL from TypeScript with pgTAP.",
  },
  { name: "tw-heropatterns", category: "dev-tools" },
  { name: "fibrae", category: "dev-tools" },
  { name: "tuirnr", category: "dev-tools" },
  {
    name: "quill",
    category: "dev-tools",
    liveUrl: "https://quill.dfg.rocks",
    description: "A small programming language, written in Go.",
  },
  { name: "foreman", category: "agent-tooling" },
  { name: "herdr-config", category: "agent-tooling" },
  {
    name: "herdr-web",
    category: "agent-tooling",
    description: "The web frontend for herdr, the terminal agent manager.",
  },
  {
    name: "dfg.codes",
    category: "sites",
    liveUrl: "https://dfg.codes",
    description: "This site — a blog with comments and likes, on Effect and Postgres.",
  },
  {
    name: "danielfgray.com",
    category: "sites",
    liveUrl: "https://danielfgray.com",
    description: "Personal site.",
  },
];
