import Head from 'next/head'
import { SimpleLayout } from '~/components/SimpleLayout'
import { useTopPosts } from '~/lib/comments'
import { getAllArticles, tagList } from '~/lib/getAllArticles'
import { useSearchParams } from 'next/navigation'
import type { Article } from '~/types'
import { TagLink, ArticleCard } from '~/components/Articles'
import { useMemo } from 'react'

export async function getStaticProps() {
  const articles = await getAllArticles()
  return {
    props: {
      articles: articles.map(({ content, ...meta }) => meta),
      allTags: tagList(articles),
    },
  }
}

export default function ArticlesIndex({ articles, allTags }: { articles: Array<Article> }) {
  const params = useSearchParams()
  const selectedTags = params.getAll('tag').filter(Boolean)
  const intro = 'All of my long-form thoughts on programming, and a few on music.'
  return (
    <SimpleLayout title="Writing on software development." intro={intro}>
      <Head>
        <title>Articles - Daniel Gray</title>
        <meta name="description" content={intro} />
      </Head>
      <ul className="flex flex-wrap items-baseline gap-1 pb-8 text-xs">
        <span className="text-primary-500">filter by: </span>
        {allTags.map(t => (
          <TagLink key={t} selectedTags={selectedTags}>
            {t}
          </TagLink>
        ))}
      </ul>
      <div className="flex flex-col space-y-16">
        {(!selectedTags
          ? articles
          : articles.filter(article => selectedTags.every(tag => article.tags.includes(tag)))
        ).map(article => (
          <ArticleCard key={article.slug} selectedTags={selectedTags} {...article} />
        ))}
      </div>
    </SimpleLayout>
  )
}
