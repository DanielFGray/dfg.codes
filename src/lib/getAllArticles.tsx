import React from 'react'
import fs from 'fs/promises'
import path from 'path'
import glob from 'fast-glob'
import readingTime from 'reading-time'
import { Article } from '~/types'

export async function getAllArticles() {
  const articleFilenames = await glob(['*.mdx', '*/index.mdx'], {
    cwd: path.join(process.cwd(), 'src/pages/articles'),
  })

  const articles = (await Promise.all(articleFilenames.map(importArticle))) as Array<Article>

  return articles.sort((a, z) => +new Date(z.date) - +new Date(a.date))
}

export function tagList(articles: Article[]) {
  const tagCount = articles
    .flatMap(a => a.tags)
    .reduce((a, c) => {
      a[c] = a[c] ? a[c] + 1 : 1
      return a
    }, {})
  return Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
}

export async function importArticle(articleFilename: string) {
  const slug = articleFilename.replace(/(\/index)?\.mdx$/, '')

  const { meta } = await import(`../pages/articles/${articleFilename}`)

  const raw = await fs.readFile(
    path.join(process.cwd(), 'src/pages/articles', articleFilename),
    'utf8',
  )

  const { words, time } = readingTime(raw)

  return {
    ...meta,
    slug,
    time: (time / 60000).toFixed(1),
    words,
  }
}
