import { Container } from '#src/components/Container.js'
import { Prose } from '#src/components/Prose.js'
import { formatDate } from '#src/lib/articles.js'
import type { ArticleMeta } from '#src/lib/articles.js'
import { QueryProvider } from '#src/lib/comments.js'
import { CommentSection } from '#src/components/Comments.js'
import { TagLink } from './Articles'

interface Props {
  meta: ArticleMeta & {
    readingTime?: number
    wordCount?: number
  }
  children: React.ReactNode
}

export function ArticleLayout({ meta, children }: Props) {
  return (
    <QueryProvider>
      <Container className="mt-16 lg:mt-32">
        <header className="mx-auto flex flex-col px-4 lg:px-0">
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-primary-800 dark:text-primary-100">
            {meta.title}
          </h1>
          <div className="text-primary-400 dark:text-primary-500">
            <time dateTime={meta.date} className="order-first mt-4 flex items-center text-base">
              <span className="h-4 w-0.5 rounded-full bg-primary-200 dark:bg-primary-500" />
              <span className="ml-3">{formatDate(meta.date)}</span>
            </time>
            {meta.tags && meta.tags.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-1 pr-8 text-xs">
                <span className="text-base">tagged:</span>
                {/* contents: the <li>s join the label's row; see routes/articles.tsx. */}
                <ul className="contents">
                  {meta.tags.map(tag => (
                    <TagLink key={tag}>{tag}</TagLink>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </header>
      </Container>
      <Prose className="article-layout mt-8">{children}</Prose>
      <Container className="mt-16 lg:mt-32">
        <CommentSection />
      </Container>
    </QueryProvider>
  )
}
