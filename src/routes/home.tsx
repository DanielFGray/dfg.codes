import { Link } from "react-router";
import { getArticles, tagList, type ArticleMeta } from "@/lib/articles";
import { Container } from "@/components/Container";
import { ArticleCard, TagLink } from "@/components/Articles";
import { SocialLinks } from "@/components/SocialIcons";
import { Button } from "@/components/Button";
import { projects, ProjectsGrid } from "./projects";

export async function loader() {
  const articles = await getArticles();
  return {
    articles: articles.slice(0, 6),
    tagList: tagList(articles),
  };
}

export default function Home({
  loaderData,
}: {
  loaderData: { articles: ArticleMeta[]; tagList: string[] };
}) {
  const { articles, tagList: tags } = loaderData;

  return (
    <>
      <Header />
      <ProjectsPreview />
      <ArticlesPreview articles={articles} tags={tags} />
    </>
  );
}

function Header() {
  return (
    <Container className="mt-9">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-primary-800 dark:text-primary-100 sm:text-5xl">
          Daniel Gray
        </h1>
        <p className="text-base text-primary-600 dark:text-primary-400">
          Software developer and musician based in Houston, Texas. I've been building for the web
          since the late '90s and work primarily with React, PostgreSQL, and Linux. I write about
          software architecture, functional programming, and the occasional intersection of code and
          creativity.
        </p>
        <ul className="flex gap-0.5">
          <SocialLinks labels={false} />
        </ul>
      </div>
    </Container>
  );
}

function ProjectsPreview() {
  return (
    <Container className="py-12">
      <ProjectsGrid projects={projects.slice(0, 3)} />
    </Container>
  );
}

function ArticlesPreview({ articles, tags }: { articles: ArticleMeta[]; tags: string[] }) {
  return (
    <>
      <Container className="py-12">
        <div className="text-xl font-semibold text-primary-700 dark:text-primary-200">
          things I write about:
        </div>
        <div className="pt-4">
          <ul className="flex flex-wrap items-baseline gap-1 text-xs">
            {tags.map((t) => (
              <TagLink key={t}>{t}</TagLink>
            ))}
          </ul>
        </div>
      </Container>
      <Container>
        <div className="flex flex-col space-y-16">
          {articles.map((article) => (
            <ArticleCard key={article.slug} {...article} />
          ))}
        </div>
        <div className="mt-16 w-full flex-1">
          <Button as={Link} to="/articles" color="secondary" className="w-full rounded-xl p-4">
            Read more
          </Button>
        </div>
      </Container>
    </>
  );
}
