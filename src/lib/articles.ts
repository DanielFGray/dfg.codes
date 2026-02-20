import type { ComponentType } from 'react'

export interface ArticleMeta {
  slug: string
  title: string
  date: string
  description?: string
  tags?: string[]
  category?: string
  readingTime?: number
  wordCount?: number
}

export interface Article extends ArticleMeta {
  Component: ComponentType<{ components?: Record<string, ComponentType<unknown>> }>
}

type MdxModule = {
  default: ComponentType<{ components?: Record<string, ComponentType<unknown>> }>
  frontmatter?: {
    title?: string
    date?: string
    description?: string
    tags?: string[]
    category?: string
  }
  readingTime?: number
  wordCount?: number
}

// Eager import all MDX files at build time
const mdxModules = import.meta.glob('../content/**/*.mdx', { eager: true }) as Record<
  string,
  MdxModule
>

function processArticlesMeta(): ArticleMeta[] {
  return Object.entries(mdxModules)
    .map(([filepath, module]) => {
      const slug = filepath.replace('../content/', '').replace('.mdx', '')
      const frontmatter = module.frontmatter || {}

      return {
        slug,
        title: frontmatter.title || slug,
        date: frontmatter.date || '',
        description: frontmatter.description,
        tags: frontmatter.tags,
        category: frontmatter.category,
        readingTime: module.readingTime,
        wordCount: module.wordCount,
      }
    })
    .sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
}

const articlesMeta = processArticlesMeta()

export async function getArticles(): Promise<ArticleMeta[]> {
  return articlesMeta
}

export async function getArticleMeta(slug: string): Promise<ArticleMeta | undefined> {
  return articlesMeta.find(a => a.slug === slug)
}

export async function getArticleSlugs(): Promise<string[]> {
  return articlesMeta.map(a => a.slug)
}

/**
 * Get the MDX component for a given slug.
 * This should be called in the component, not in a loader.
 */
export function getArticleComponent(
  slug: string,
): ComponentType<{ components?: Record<string, ComponentType<unknown>> }> | undefined {
  const filepath = `../content/${slug}.mdx`
  const module = mdxModules[filepath]
  return module?.default
}

export function tagList(articles: ArticleMeta[]): string[] {
  const tags = new Set<string>()
  articles.forEach(a => a.tags?.forEach(t => tags.add(t)))
  return [...tags].sort()
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
