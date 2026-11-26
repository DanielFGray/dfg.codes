// The four content sections of the home stack, in the "index rail" look: a numeral and
// title in a rail on the left (stacked above the content on a phone), content on the right.
import { Link } from "react-router";
import { bio, EMAIL } from "#src/data/about.js";
import { categories } from "#src/data/projects.js";
import { uses } from "#src/data/uses.js";
import type { ArticleMeta } from "#src/lib/articles.js";
import type { Project } from "#src/services/projects.js";
import { socials } from "#src/components/SocialIcons.js";

const GITHUB_PROFILE = "https://github.com/danielfgray";

/** `@name` from a profile URL such as `https://github.com/name`. */
const handle = (href: string) => `@${new URL(href).pathname.slice(1)}`;

// Colour roles for the rail look, so a re-theme edits this block and the CSS variables.
const link = "text-stack-strong hover:text-stack-accent";
const faint = "font-mono text-stack-faint";
const divider = "border-stack-line";

export function About() {
  return (
    <RailSection id="about" numeral="01" title="About">
      <div className="flex flex-col gap-10 lg:flex-row">
        <img
          src="/portrait.jpg"
          alt="Daniel F. Gray"
          className="w-48 self-start rounded grayscale"
        />
        <div className="space-y-10">
          <div className="max-w-prose space-y-4 text-lg leading-relaxed">
            {bio.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <ul className="space-y-3 text-sm">
            <li>
              <a href={`mailto:${EMAIL}`} className={`${link} font-medium`}>
                {EMAIL}
              </a>
            </li>
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} className={`group flex items-center gap-3 ${link}`}>
                  <s.icon className="h-5 w-5 flex-none fill-stack-faint group-hover:fill-stack-accent" />
                  <span>{s.label}</span>
                  <span className={faint}>{handle(s.href)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </RailSection>
  );
}

export function Projects({ projects }: { projects: readonly Project[] | null }) {
  return (
    <RailSection id="projects" numeral="02" title="Projects">
      {projects === null ? (
        <p className="text-stack-muted">
          The project list is unavailable right now. The code is on{" "}
          <a href={GITHUB_PROFILE} className={link}>
            GitHub
          </a>
          .
        </p>
      ) : (
        <div className="space-y-12">
          {categories.map((category) => {
            const inCategory = projects.filter((p) => p.category === category.id);
            if (inCategory.length === 0) return null;
            return (
              <div key={category.id}>
                <h3 className={`mb-2 text-xs ${faint}`}>{category.label}</h3>
                <ul className={`divide-y border-y ${divider} divide-stack-line`}>
                  {inCategory.map((project) => (
                    <ProjectRow key={project.name} project={project} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </RailSection>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const href = project.liveUrl ?? project.repoUrl;
  const meta = [project.language, project.stars != null ? `${project.stars}★` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-6">
      <div className="font-mono text-sm break-words">
        {href ? (
          <a href={href} className={link}>
            {project.name}
          </a>
        ) : (
          <span className="text-stack-strong">{project.name}</span>
        )}
        {project.liveUrl && project.repoUrl && (
          <a href={project.repoUrl} className="ml-3 text-xs text-stack-faint hover:text-stack-accent">
            source
          </a>
        )}
      </div>
      <div className="text-sm text-stack-muted">
        {project.description}
        {meta && <span className={`mt-1 block text-xs ${faint}`}>{meta}</span>}
      </div>
    </li>
  );
}

export function Uses() {
  return (
    <RailSection id="uses" numeral="03" title="Uses">
      <div className="space-y-12">
        {uses.map((group) => (
          <div key={group.title}>
            <h3 className={`mb-4 text-xs ${faint}`}>{group.title}</h3>
            <dl className="space-y-4">
              {group.items.map((item) => (
                <div key={item.title} className="grid gap-1 sm:grid-cols-[16rem_1fr] sm:gap-6">
                  <dt className="text-stack-strong">
                    {item.href ? (
                      <a href={item.href} className={`${link} underline`}>
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </dt>
                  <dd className="text-sm text-stack-muted">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </RailSection>
  );
}

export function Blog({
  articles,
  tags,
}: {
  articles: readonly ArticleMeta[];
  tags: readonly string[];
}) {
  return (
    <RailSection id="blog" numeral="04" title="Blog">
      <ul className={`divide-y border-y ${divider} divide-stack-line`}>
        {articles.map((article) => (
          <li key={article.slug} className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr_auto] sm:gap-6">
            <time dateTime={article.date} className={`text-sm ${faint}`}>
              {article.date.slice(0, 10)}
            </time>
            <Link to={`/articles/${article.slug}`} className={link}>
              {article.title}
            </Link>
            <span className={`text-xs ${faint}`}>{article.tags?.slice(0, 2).join(" ")}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-8 flex flex-wrap gap-x-4 gap-y-1">
        {tags.map((tag) => (
          <li key={tag}>
            <Link
              to={`/articles?tag=${encodeURIComponent(tag)}`}
              className="font-mono text-xs text-stack-muted hover:text-stack-accent"
            >
              #{tag}
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/articles" className="mt-8 inline-block font-mono text-sm text-stack-accent">
        all articles →
      </Link>
    </RailSection>
  );
}

/** One rail row. At least a screen tall, so a section's top can always reach the screen's top. */
function RailSection({
  id,
  numeral,
  title,
  children,
}: {
  id: string;
  numeral: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid min-h-dvh grid-cols-1 gap-x-10 px-6 sm:px-12 md:grid-cols-[14rem_1fr]"
    >
      <div className="pt-16 md:sticky md:top-0 md:h-dvh md:py-24">
        <p aria-hidden="true" className="font-mono text-7xl font-light text-stack-numeral">
          {numeral}
        </p>
        <h2
          id={`${id}-title`}
          className="mt-2 text-sm font-semibold tracking-[0.2em] text-stack-strong uppercase"
        >
          {title}
        </h2>
      </div>
      <div className="min-w-0 py-12 md:py-24">{children}</div>
    </section>
  );
}
