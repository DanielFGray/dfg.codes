import { useSearchParams } from "react-router";
import { SimpleLayout } from "@/components/SimpleLayout";
import { getArticles, tagList, type ArticleMeta } from "@/lib/articles";
import { TagLink, ArticleCard } from "@/components/Articles";

export async function loader() {
  const articles = await getArticles();
  return {
    articles,
    allTags: tagList(articles),
  };
}

export default function ArticlesIndex({
  loaderData,
}: {
  loaderData: { articles: ArticleMeta[]; allTags: string[] };
}) {
  const { articles, allTags } = loaderData;
  const [searchParams] = useSearchParams();
  const selectedTags = searchParams.getAll("tag").filter(Boolean);
  const intro = "All of my long-form thoughts on programming, and a few on music.";

  const filteredArticles = selectedTags.length
    ? articles.filter((article) => selectedTags.every((tag) => article.tags?.includes(tag)))
    : articles;

  const intersectingTags = selectedTags.length
    ? [...new Set(filteredArticles.flatMap((a) => a.tags ?? []))]
    : [];

  return (
    <SimpleLayout title="Writing on software development." intro={intro}>
      <ul className="flex flex-wrap items-baseline gap-1 pb-8 text-xs">
        <span className="text-primary-500">filter by: </span>
        {allTags.map((t) => (
          <TagLink key={t} intersecting={intersectingTags} selectedTags={selectedTags}>
            {t}
          </TagLink>
        ))}
      </ul>
      <div className="flex flex-col space-y-16">
        {filteredArticles.map((article) => (
          <ArticleCard key={article.slug} selectedTags={selectedTags} {...article} />
        ))}
      </div>
    </SimpleLayout>
  );
}
