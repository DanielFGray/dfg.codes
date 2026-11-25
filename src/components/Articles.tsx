import { Link, useSearchParams } from "react-router";
import { Label, Tag, TagGroup, TagList, type Selection } from "react-aria-components";
export { ArticleLayout } from "#src/components/ArticleLayout.js";
import clsx from "clsx";
import { formatDate } from "#src/lib/articles.js";
import { labelize } from "#src/lib/labelize.js";
import { Card } from "#src/components/Card.js";
import type { ArticleMeta } from "#src/lib/articles.js";

// The index filter selects tags rather than navigating: each tag toggles its membership
// in the ?tag= search params, so a filter is a shareable URL and the back button walks
// filter states. RAC TagGroup supplies the multiple-selection and keyboard behavior.
export function TagFilter({
  allTags,
  selectedTags,
  intersectingTags,
}: {
  allTags: string[];
  selectedTags: string[];
  intersectingTags: string[];
}) {
  const [, setSearchParams] = useSearchParams();

  const onSelectionChange = (selection: Selection) => {
    setSearchParams((params) => {
      params.delete("tag");
      for (const key of selection === "all" ? allTags : selection) {
        params.append("tag", String(key));
      }
      return params;
    });
  };

  return (
    <TagGroup
      selectionMode="multiple"
      selectedKeys={new Set(selectedTags)}
      onSelectionChange={onSelectionChange}
      disabledKeys={
        new Set(
          // An empty intersection (the selected tags match no article) disables
          // nothing, as the old dimming did: the selection that emptied the list
          // must stay undoable, and a selected tag is never disabled.
          selectedTags.length && intersectingTags.length
            ? allTags.filter((tag) => !intersectingTags.includes(tag))
            : [],
        )
      }
      className="flex flex-wrap items-baseline gap-1 pb-8 text-xs"
    >
      <Label className="text-primary-500">filter by: </Label>
      {/* contents: the tag <div>s join the label's wrapping row instead of the list
          sitting in it as one flex item, which would push the whole list to its own row. */}
      <TagList items={allTags} className="contents">
        {(tag) => (
          <Tag
            id={tag}
            className={({ isSelected, isDisabled, isFocusVisible }) =>
              clsx(
                "rounded-md px-1 pb-0.5 outline outline-1 outline-transparent transition-opacity duration-200",
                isDisabled && "opacity-5",
                !isDisabled && "cursor-pointer",
                !isDisabled &&
                  isFocusVisible &&
                  "outline-2 outline-offset-2 outline-secondary-600",
                isSelected
                  ? "bg-secondary-600 text-secondary-50"
                  : "bg-primary-100/50 text-primary-600 hover:outline-secondary-300 dark:bg-primary-800 dark:text-primary-400 dark:hover:outline-secondary-800",
              )
            }
          >
            {tag}
          </Tag>
        )}
      </TagList>
    </TagGroup>
  );
}

export function TagLink({
  children: tag,
  selectedTags,
}: {
  children: string;
  selectedTags?: string[];
}) {
  // The link targets the current filter with this tag toggled; the toggled tag
  // goes first, matching the hrefs the links built before the filter selected.
  const next = selectedTags?.includes(tag)
    ? selectedTags.filter((t) => t !== tag)
    : [tag, ...(selectedTags ?? [])];
  const params = new URLSearchParams();
  next.forEach((t) => params.append("tag", t));
  const search = params.toString() ? `?${params}` : "";

  return (
    <li>
      <Link
        to={`/articles${search}`}
        className={clsx(
          "block rounded-md px-1 pb-0.5 outline outline-1 outline-transparent transition-opacity duration-200",
          selectedTags?.includes(tag)
            ? "bg-secondary-600 text-secondary-50"
            : "bg-primary-100/50 text-primary-600 hover:outline-secondary-300 dark:bg-primary-800 dark:text-primary-400 dark:hover:outline-secondary-800",
        )}
      >
        {tag}
      </Link>
    </li>
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
