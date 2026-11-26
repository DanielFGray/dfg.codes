import { Card } from "#src/components/Card.js";
import { SimpleLayout } from "#src/components/SimpleLayout.js";
import { LinkIcon } from "#src/components/SocialIcons.js";
import { categories } from "#src/data/projects.js";
import { useProjects } from "#src/lib/projects.js";
import type { Project } from "#src/services/projects.js";
import clsx from "clsx";

const projectLink = (project: Project): string | null => project.liveUrl ?? project.repoUrl;

const projectLinkLabel = (project: Project): string | null => {
  const href = projectLink(project);
  return href ? href.replace(/^https?:\/\//, "") : null;
};

export function ProjectsGrid({ projects }: { projects: readonly Project[] }) {
  return (
    <ul
      className={clsx(
        "grid grid-cols-1 gap-x-12 gap-y-16",
        projects.length === 1
          ? ""
          : projects.length % 2 === 0
            ? "lg:grid-cols-2"
            : "lg:grid-cols-3",
      )}
    >
      {projects.map((project) => {
        const href = projectLink(project);
        return (
          <Card as="li" key={project.name}>
            <h2 className="mt-6 text-base font-semibold text-primary-800 dark:text-primary-100">
              {href ? <Card.Link href={href}>{project.name}</Card.Link> : project.name}
            </h2>
            {project.description && <Card.Description>{project.description}</Card.Description>}
            {(project.language || project.stars != null) && (
              <p className="relative z-10 mt-2 text-xs text-primary-500 dark:text-primary-400">
                {[project.language, project.stars != null ? `${project.stars}★` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {href && (
              <p className="relative z-10 mt-6 flex text-sm font-medium text-primary-800 transition group-hover:text-secondary-500 dark:text-primary-200">
                <LinkIcon className="h-6 w-6 flex-none" />
                <span className="ml-2">{projectLinkLabel(project)}</span>
              </p>
            )}
          </Card>
        );
      })}
    </ul>
  );
}

export default function Projects() {
  const { data } = useProjects();
  const all = data ?? [];

  return (
    <SimpleLayout
      title="Things I've made trying to put my dent in the universe."
      intro="I've worked on tons of little projects over the years but these are the ones that I'm most proud of. Many of them are open-source, so if you see something that piques your interest, check out the code and contribute if you have ideas for how it can be improved."
    >
      {categories.map((category) => {
        const inCategory = all.filter((project) => project.category === category.id);
        if (inCategory.length === 0) return null;
        return (
          <section key={category.id} className="mt-16 first:mt-0">
            <h2 className="text-lg font-semibold text-primary-700 dark:text-primary-200">
              {category.label}
            </h2>
            <div className="mt-8">
              <ProjectsGrid projects={inCategory} />
            </div>
          </section>
        );
      })}
    </SimpleLayout>
  );
}
