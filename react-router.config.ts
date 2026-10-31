import type { Config } from "@react-router/dev/config";
import * as fs from "fs";
import * as path from "path";

// Get article slugs from MDX files at build time
function getArticleSlugs(): string[] {
  const contentDir = path.join(process.cwd(), "src/content");

  if (!fs.existsSync(contentDir)) {
    return [];
  }

  const files = fs.readdirSync(contentDir);

  return files
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(".mdx", ""));
}

export default {
  appDirectory: "src",
  buildDirectory: "dist",

  // Keep prerendering for content pages, but enable a real server runtime so
  // comments/auth/data can move behind server code.
  ssr: true,

  // Keep all routes in the initial manifest while the app straddles prerendered
  // pages and server-backed dynamic features.
  routeDiscovery: { mode: "initial" },

  // Pre-render the mostly-static pages at build time.
  async prerender() {
    const slugs = getArticleSlugs();
    return [
      "/",
      "/articles",
      "/about",
      "/projects",
      "/uses",
      ...slugs.map((slug) => `/articles/${slug}`),
    ];
  },
} satisfies Config;
