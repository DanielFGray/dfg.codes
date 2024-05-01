import Head from 'next/head'
import Link from 'next/link'
import type { Article } from '~/types'
import { Container } from './Container'
import { CommentSection } from './Comments'
import { formatDate } from '~/lib/formatDate'
import { QueryProvider, useTopPosts } from '~/lib/comments'
import { Prose } from './Prose'
import { labelize } from '~/lib/labelize'
import { Card } from './Card'
import { classed } from '@tw-classed/react'

const gravatarURL = process.env.NEXT_PUBLIC_GRAVATAR_URL

export function ArticleLayout({
  children,
  isRssFeed = false,
  meta,
}: {
  isRssFeed?: boolean
  children: React.ReactNode
  meta: Article
}) {
  if (isRssFeed) return children
  const tags = [meta.category].concat(meta.tags ?? [])
  const title = `${meta.title} - DanielFGray`
  return (
    <QueryProvider>
      <Head>
        <title>{title}</title>
        <meta name="keywords" content={tags.join(' ')} />
        <meta name="description" content={meta.description} />
        <meta name="twitter:title" content={title} />
        <meta
          name="twitter:description"
          content={(meta.description ?? '').concat(tags.map(t => `#${t}`).join(' '))}
        />
        <meta name="twitter:image" content={meta.image ?? gravatarURL} key="twitter:image" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:type" content="article" />
        {tags.map(tag => (
          <meta property="og:article:tag" content={tag} key={tag} />
        ))}
        <meta property="og:image" content={meta.image ?? gravatarURL} key="og:image" />
      </Head>
      <ArticleHeader meta={meta} />
      <Prose className="article-layout mt-8 px-4 lg:px-0">{children}</Prose>
      <Container className="mt-16 lg:mt-32">
        <CommentSection />
      </Container>
    </QueryProvider>
  )
}

function ArticleHeader({ meta }: { meta: Article }) {
  const { data: stats } = useTopPosts()
  return (
    <header className="mx-auto flex max-w-5xl flex-col px-4 lg:px-0">
      <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-primary-800 dark:text-primary-100">
        {meta.title}
      </h1>
      <div className="text-primary-400 dark:text-primary-500">
        <time dateTime={meta.date} className="order-first mt-4 flex items-center text-base">
          <span className="h-4 w-0.5 rounded-full bg-primary-200 dark:bg-primary-500" />
          <span className="ml-3">{formatDate(meta.date)}</span>
        </time>
        {!meta?.tags?.length ? null : (
          <ul className="flex flex-wrap items-baseline gap-1 pr-8 text-xs">
            <span className="text-base">tagged:</span>
            {meta.tags.map(tag => (
              <TagLink key={tag}>{tag}</TagLink>
            ))}
          </ul>
        )}
        {!stats?.[meta.slug] ? null : <div>{labelize({ comment: stats[meta.slug] })}</div>}
      </div>
    </header>
  )
}

export function TagLink({ children: tag, selectedTags }: { children: string; selectedTags?: Array<string> }) {
  const query =
    selectedTags && selectedTags.length === 1 && selectedTags[0] === tag
      ? {}
      : selectedTags?.includes(tag)
        ? { tag: selectedTags.filter(t => t !== tag) }
        : { tag: [tag].concat(selectedTags ?? []) }
  return (
    <Link key={tag} href={{ pathname: `/articles`, query }} prefetch={false}>
      <Pill selected={selectedTags?.includes(tag)}>{tag}</Pill>
    </Link>
  )
}

const Pill = classed(
  'li',
  'rounded-md px-1 pb-0.5 outline outline-1 outline-transparent',
  {
    variants: {
      selected: {
        true: 'bg-secondary-600 text-secondary-50',
        false:
          'bg-primary-100/50 text-primary-600 hover:outline-secondary-300 dark:bg-primary-800 dark:text-primary-400 dark:hover:outline-secondary-800',
      },
    },
    defaultVariants: { selected: false },
  },
)

export function ArticleCard({
  selectedTags,
  ...article
}: Article & {
  selectedTags?: Array<string>
  comment_count?: string
  total_votes?: number
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
            minute: article.time,
            word: article.words,
            comment: article.comment_count,
            vote: article.total_votes,
          })}
        </Card.Description>
        <ul className="-ml-1 flex flex-wrap gap-1 text-xs md:hidden">
          {article.tags.map(tag => (
            <TagLink key={tag} selectedTags={selectedTags}>{tag}</TagLink>
          ))}
        </ul>
        <Card.Cta>Read article</Card.Cta>
      </Card>
      <Card.Eyebrow as="div" className="mt-1 hidden md:block">
        <time dateTime={article.date}>{formatDate(article.date)}</time>
        <ul className="md:h flex flex-wrap gap-1 pr-8 text-xs">
          {article.tags.map(tag => (
            <TagLink key={tag} selectedTags={selectedTags}>{tag}</TagLink>
          ))}
        </ul>
      </Card.Eyebrow>
    </article>
  )
}
