import { Link } from "react-router";
export { ArticleLayout } from "@/components/ArticleLayout";
import clsx from "clsx";
import { formatDate } from "@/lib/articles";
import { labelize } from "@/lib/labelize";
import { Card } from "@/components/Card";
import type { ArticleMeta } from "@/lib/articles";

export function TagLink({
  children: tag,
  intersecting,
  selectedTags,
}: {
  children: string;
  intersecting?: string[];
  selectedTags?: string[];
}) {
  const params = new URLSearchParams();
  const search = (() => {
    if (selectedTags && selectedTags.length === 1 && selectedTags[0] === tag) {
      return "";
    } else if (selectedTags?.includes(tag)) {
      selectedTags.filter((t) => t !== tag).forEach((t) => params.append("tag", t));
      return params.toString() ? "?" + params.toString() : "";
    } else {
      const params = new URLSearchParams();
      [tag].concat(selectedTags ?? []).forEach((t) => params.append("tag", t));
      return "?" + params.toString();
    }
  })();

  const selected = selectedTags?.includes(tag);

  return (
    <Link
      to={`/articles${search}`}
      className={
        clsx(
          "transition-opacity duration-200",
          selectedTags?.length && intersecting?.length && !intersecting.includes(tag)
            ? "opacity-5 pointer-events-none"
            : "opacity-100",
        )
      }
    >
      <li
        className={clsx(
          "rounded-md px-1 pb-0.5 outline outline-1 outline-transparent",
          selected
            ? "bg-secondary-600 text-secondary-50"
            : "bg-primary-100/50 text-primary-600 hover:outline-secondary-300 dark:bg-primary-800 dark:text-primary-400 dark:hover:outline-secondary-800",
        )}
      >
        {tag}
      </li>
    </Link>
  );
}

export function ArticleCard({
  selectedTags,
  ...article
}: ArticleMeta & {
  selectedTags?: string[];
  comment_count?: string;
  total_votes?: number;
}) {
  return (
    <article className="md:grid md:grid-cols-4 md:items-baseline">
      <Card className="md:col-span-3">
        <Card.Title href={`/articles/${article.slug}`}>{article.title}</Card.Title>
        <Card.Eyebrow as="time" dateTime={article.date} className="md:hidden">
          {formatDate(article.date)}
        </Card.Eyebrow>
        <Card.Description>{article.description}</Card.Description>
        <Card.Description className="font-light">
          {labelize({
            minute: article.readingTime ?? 0,
            word: article.wordCount ?? 0,
          })}
        </Card.Description>
        {article.tags && (
          <ul className="-ml-1 flex flex-wrap gap-1 text-xs md:hidden">
            {article.tags.map((tag) => (
              <TagLink key={tag} selectedTags={selectedTags}>
                {tag}
              </TagLink>
            ))}
          </ul>
        )}
        <Card.Cta>Read article</Card.Cta>
      </Card>
      <Card.Eyebrow as="div" className="mt-1 hidden md:block">
        <time dateTime={article.date}>{formatDate(article.date)}</time>
        {article.tags && (
          <ul className="flex flex-wrap gap-1 pr-8 text-xs">
            {article.tags.map((tag) => (
              <TagLink key={tag} selectedTags={selectedTags}>
                {tag}
              </TagLink>
            ))}
          </ul>
        )}
      </Card.Eyebrow>
    </article>
  );
}
