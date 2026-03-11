import { type Plugin } from 'vite'
import * as fs from 'fs'
import * as path from 'path'
import readingTime from 'reading-time'

const VIRTUAL_ID = 'virtual:article-meta'
const RESOLVED_ID = '\0' + VIRTUAL_ID

interface ArticleMetaEntry {
  slug: string
  title: string
  date: string
  description?: string
  tags?: string[]
  category?: string
  readingTime: number
  wordCount: number
}

/** Parse YAML frontmatter from raw MDX text */
function parseFrontmatter(raw: string): Record<string, string | string[]> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const result: Record<string, string | string[]> = {}
  const lines = match[1].split('\n')
  let currentKey = ''

  for (const line of lines) {
    // Block array item: "  - value"
    const itemMatch = line.match(/^\s+-\s+(.+)/)
    if (itemMatch && currentKey) {
      const arr = result[currentKey]
      if (Array.isArray(arr)) arr.push(itemMatch[1].trim())
      continue
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w+):\s*(.*)/)
    if (!kvMatch) continue
    const [, key, rawValue] = kvMatch
    currentKey = key

    // Flow array: [a, b, c]
    const arrMatch = rawValue.match(/^\[(.*)\]$/)
    if (arrMatch) {
      result[key] = arrMatch[1].split(',').map(s => s.trim())
      continue
    }

    // Block array (value is empty, items follow)
    if (rawValue === '') {
      result[key] = []
      continue
    }

    // Scalar — strip surrounding quotes and unescape YAML doubled quotes
    result[key] = rawValue.replace(/^['"]|['"]$/g, '').replace(/''/g, "'")
  }

  return result
}

function buildArticleMeta(contentDir: string): ArticleMetaEntry[] {
  if (!fs.existsSync(contentDir)) return []

  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.mdx'))

  return files.map(file => {
    const raw = fs.readFileSync(path.join(contentDir, file), 'utf-8')
    const fm = parseFrontmatter(raw)

    // Strip frontmatter + imports + code blocks + tags for reading time
    const body = raw
      .replace(/^---[\s\S]*?---/, '')
      .replace(/^import\s.+$/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/<[^>]+>/g, '')
    const stats = readingTime(body)

    return {
      slug: file.replace('.mdx', ''),
      title: (fm.title as string) || file.replace('.mdx', ''),
      date: (fm.date as string) || '',
      description: fm.description as string | undefined,
      tags: Array.isArray(fm.tags) ? fm.tags : undefined,
      category: fm.category as string | undefined,
      readingTime: Math.ceil(stats.minutes),
      wordCount: stats.words,
    }
  })
}

export function articleMeta(): Plugin {
  const contentDir = path.join(process.cwd(), 'src/content')

  return {
    name: 'article-meta',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      const meta = buildArticleMeta(contentDir)
      return `export default ${JSON.stringify(meta)}`
    },
  }
}
