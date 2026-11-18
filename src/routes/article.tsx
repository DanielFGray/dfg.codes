import { redirect } from 'react-router'
import {
  getArticleMeta,
  getArticleImporter,
  type ArticleMeta,
  type ArticleComponent,
} from '../lib/articles'
import { ArticleLayout } from '../components/ArticleLayout'
import { Code } from '../components/Code'
import { CH, InlineScrollycoding } from '../components/Scrollycoding'
import { isValidElement, lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

function childrenToText(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  if (isValidElement<{ children?: ReactNode }>(children))
    return childrenToText(children.props.children)
  return ''
}

function LinkedHeading({ as: Tag, children }: { as: 'h2' | 'h3' | 'h4'; children: ReactNode }) {
  const id = slugify(childrenToText(children))
  return (
    <Tag id={id} className="group">
      <a href={`#${id}`} className="no-underline text-inherit">
        <span className="hover:underline">{children}</span>
        <span className="ml-2 text-sm opacity-0 transition-opacity group-hover:opacity-70 group-active:opacity-70">🔗</span>
      </a>
    </Tag>
  )
}

// Lazy-loaded heavy components — only fetched when an article actually uses them
const LazyEditor = lazy(() => import('../components/Editor'))
const LazyAdventure = lazy(() => import('../components/adventure/context').then(m => ({ default: m.Adventure })))
const LazyAdventureCode = lazy(() => import('../components/adventure/AdventureCode').then(m => ({ default: m.AdventureCode })))
const LazyPick = lazy(() => import('../components/adventure/Pick').then(m => ({ default: m.Pick })))
const LazyVariant = lazy(() => import('../components/adventure/Variant').then(m => ({ default: m.Variant })))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withSuspense(Component: ComponentType<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function SuspenseWrapper(props: any) {
    return (
      <Suspense fallback={null}>
        <Component {...props} />
      </Suspense>
    )
  }
}

// MDX components available in articles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdxComponents: Record<string, any> = {
  Code,
  CH,
  Scrollycoding: InlineScrollycoding,
  Editor: withSuspense(LazyEditor),
  Adventure: withSuspense(LazyAdventure),
  AdventureCode: withSuspense(LazyAdventureCode),
  Pick: withSuspense(LazyPick),
  Variant: withSuspense(LazyVariant),
  h2: (props: { children: ReactNode }) => <LinkedHeading as="h2" {...props} />,
  h3: (props: { children: ReactNode }) => <LinkedHeading as="h3" {...props} />,
  h4: (props: { children: ReactNode }) => <LinkedHeading as="h4" {...props} />,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyArticles = new Map<string, LazyExoticComponent<ArticleComponent>>()

async function loadArticle(slug: string) {
  const importer = getArticleImporter(slug)
  if (importer) {
    await importer()
  }
}

function getArticleComponent(slug: string): LazyExoticComponent<ArticleComponent> | undefined {
  if (!lazyArticles.has(slug)) {
    const importer = getArticleImporter(slug)
    if (importer) {
      lazyArticles.set(slug, lazy(importer))
    }
  }

  return lazyArticles.get(slug)
}

// Posts that became a course on dfg.rocks. A 301 tells browsers and search engines the move is permanent.
const COURSE_URL = 'https://dfg.rocks/courses/b923f9a1-ae77-4daa-b434-67a06a8435a9'
const movedToCourse = new Set(['beginning-drums', 'rudimental-permutations'])

export async function loader({ params }: { params: { slug: string } }) {
  if (movedToCourse.has(params.slug)) {
    throw redirect(COURSE_URL, 301)
  }
  const meta = await getArticleMeta(params.slug)
  if (!meta) {
    throw new Response('Not Found', { status: 404 })
  }
  return { meta }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function clientLoader({ params, serverLoader }: any) {
  const data = await serverLoader()
  await loadArticle(params.slug)
  return data
}
// Load MDX chunk before hydration so the client matches pre-rendered HTML
clientLoader.hydrate = true as const

export default function ArticlePage({ loaderData }: { loaderData: { meta: ArticleMeta } }) {
  const { meta } = loaderData
  const Content = getArticleComponent(meta.slug)

  if (!Content) {
    return <div>Article content not found</div>
  }

  return (
    <ArticleLayout meta={meta}>
      <Suspense fallback={null}>
        <Content components={mdxComponents} />
      </Suspense>
    </ArticleLayout>
  )
}
