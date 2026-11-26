import { getArticles, tagList } from "#src/lib/articles.js";
import { loadProjects } from "#src/lib/projects.server.js";

/** How many articles the Blog section lists. */
const RECENT_ARTICLES = 6;

/**
 * The data behind the home stack. Every section route uses this loader, so the server
 * HTML of each one carries the project list and the recent articles.
 */
export async function stackLoader() {
  const [articles, projects] = await Promise.all([
    getArticles(),
    loadProjects(),
  ]);
  return {
    articles: articles.slice(0, RECENT_ARTICLES),
    tags: tagList(articles),
    projects,
  };
}
