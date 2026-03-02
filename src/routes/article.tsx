import { getArticleMeta, getArticleComponent, type ArticleMeta } from '../lib/articles'
import { ArticleLayout } from '../components/ArticleLayout'
import { Code } from '../components/Code'
import { CH, InlineScrollycoding } from '../components/Scrollycoding'
import { Editor } from '../components/Editor'
import type { ReactNode } from 'react'

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
  if (children && typeof children === 'object' && 'props' in children)
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

// MDX components available in articles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdxComponents: Record<string, any> = {
  Code,
  CH,
  Scrollycoding: InlineScrollycoding,
  Editor,
  h2: (props: { children: ReactNode }) => <LinkedHeading as="h2" {...props} />,
  h3: (props: { children: ReactNode }) => <LinkedHeading as="h3" {...props} />,
  h4: (props: { children: ReactNode }) => <LinkedHeading as="h4" {...props} />,
}

export async function loader({ params }: { params: { slug: string } }) {
  const meta = await getArticleMeta(params.slug)
  if (!meta) {
    throw new Response('Not Found', { status: 404 })
  }
  // Only return serializable metadata, not the Component
  return { meta }
}

export default function ArticlePage({ loaderData }: { loaderData: { meta: ArticleMeta } }) {
  const { meta } = loaderData
  // Get the component directly (not from loader - components aren't serializable)
  const Content = getArticleComponent(meta.slug)

  if (!Content) {
    return <div>Article content not found</div>
  }

  return (
    <ArticleLayout meta={meta}>
      <Content components={mdxComponents} />
    </ArticleLayout>
  )
}
