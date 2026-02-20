import { getArticleMeta, getArticleComponent, type ArticleMeta } from '../lib/articles'
import { ArticleLayout } from '../components/ArticleLayout'
import { Code } from '../components/Code'
import { CH, InlineScrollycoding } from '../components/Scrollycoding'
import { Editor } from '../components/Editor'

// MDX components available in articles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdxComponents: Record<string, any> = {
  Code,
  CH,
  Scrollycoding: InlineScrollycoding,
  Editor,
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
