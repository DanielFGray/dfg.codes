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

  // Disable runtime SSR for pure static deployment
  ssr: false,

  // Disable lazy route discovery - include all routes in initial manifest
  // This is required for static deployment where /__manifest endpoint is not available
  routeDiscovery: { mode: "initial" },

  // Pre-render all routes at build time
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
