import { projects } from "../../src/data/projects.js";
import { Project, type RepoInfo } from "../../src/services/projects.js";

/**
 * Join the in-repo registry (selection, category, live link) with the cached
 * GitHub data (description, stars, language, repo link). A registry entry with
 * no public repo keeps its hand-written description and has no repo link.
 */
export const mergeProjects = (repos: readonly RepoInfo[]): readonly Project[] => {
  const byName = new Map(repos.map((repo) => [repo.name, repo] as const));

  return projects.map((entry) => {
    const repo = byName.get(entry.gh ?? entry.name);
    return new Project({
      name: entry.name,
      description: repo?.description ?? entry.description ?? null,
      category: entry.category,
      stars: repo?.stargazers_count ?? null,
      language: repo?.language ?? null,
      liveUrl: entry.liveUrl ?? null,
      repoUrl: repo?.html_url ?? null,
    });
  });
};
