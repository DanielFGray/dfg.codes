import type { LoaderFunctionArgs } from "react-router";
import { getArticles, tagList } from "#src/lib/articles.js";
import { fetchProjects } from "#src/lib/projects.server.js";

/** How many articles the Blog section lists. */
const RECENT_ARTICLES = 6;

/**
 * The data behind the home stack. Every section route uses this loader, so the server
 * HTML of each one carries the project list and the recent articles.
 */
export async function stackLoader({ request }: LoaderFunctionArgs) {
  const [articles, projects] = await Promise.all([
    getArticles(),
    fetchProjects(projectsOrigin(request)),
  ]);
  return {
    articles: articles.slice(0, RECENT_ARTICLES),
    tags: tagList(articles),
    projects,
  };
}

/**
 * Where this server's own API listens. In development the page server proxies `/api`, so
 * the request's origin works. In production the app and the API share one process on
 * PORT, and calling it by loopback avoids a round trip through the public host.
 */
function projectsOrigin(request: Request): string {
  if (import.meta.env.DEV) return new URL(request.url).origin;
  return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}
