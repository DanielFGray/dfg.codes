/// <reference types="vite/client" />

declare module '*.mdx' {
  import type { ComponentType } from 'react'

  export const frontmatter: {
    title?: string
    date?: string
    description?: string
    tags?: string[]
    category?: string
  }
  export const readingTime: number | undefined
  export const wordCount: number | undefined

  const MDXComponent: ComponentType<{
    components?: Record<string, ComponentType<unknown>>
  }>
  export default MDXComponent
}
