#!/usr/bin/env node
/**
 * Codemod: Convert Code Hike v0.x syntax to v1.
 *
 * Handles:
 * - export const meta = {...} → YAML frontmatter
 * - ArticleLayout import + default export → removed
 * - <CH.Scrollycoding> blocks (--- separators → ## !!steps headings)
 * - Code fence info string annotations (focus=, bg=, mark= → inline annotation comments)
 * - Filename format in info strings (```lang file → ```lang ! file)
 * - Standalone annotated code fences outside scrollycoding blocks
 *
 * Usage:
 *   node scripts/migrate-codehike.mjs <file.mdx>           # preview to stdout
 *   node scripts/migrate-codehike.mjs <file.mdx> --write   # modify in place
 *   node scripts/migrate-codehike.mjs src/content/*.mdx --write
 */
import fs from 'node:fs'

// ── Comment syntax per language ─────────────────────────────────────────────
function commentFor(lang) {
  switch (lang) {
    case 'sql':
      return { open: '-- ', close: '' }
    case 'python': case 'py': case 'rb': case 'ruby':
    case 'sh': case 'bash': case 'shell': case 'zsh':
    case 'yaml': case 'yml': case 'toml':
      return { open: '# ', close: '' }
    case 'css': case 'scss': case 'less':
      return { open: '/* ', close: ' */' }
    case 'html': case 'xml': case 'svg': case 'mdx': case 'md':
      return { open: '<!-- ', close: ' -->' }
    default: // js, jsx, ts, tsx, json, c, java, go, rust, etc
      return { open: '// ', close: '' }
  }
}

function makeAnnotation(lang, name, rangeExpr) {
  const { open, close } = commentFor(lang)
  return `${open}!${name}${rangeExpr || ''}${close}`
}

// ── Parse a v0.x range spec like "1:7", "2,8", "2,12:31", "4[25:60],11:36" ─
function parseRangeSpec(spec) {
  const ranges = []
  for (const part of spec.split(',')) {
    // Character range on a specific line: 4[25:60]
    const charMatch = part.match(/^(\d+)\[(.+)\]$/)
    if (charMatch) {
      ranges.push({ start: +charMatch[1], end: +charMatch[1], chars: charMatch[2] })
      continue
    }
    // Line range: 12:31
    const rangeMatch = part.match(/^(\d+):(\d+)$/)
    if (rangeMatch) {
      ranges.push({ start: +rangeMatch[1], end: +rangeMatch[2] })
      continue
    }
    // Single line: 8
    const line = parseInt(part)
    if (!isNaN(line)) {
      ranges.push({ start: line, end: line })
    }
  }
  return ranges
}

// ── Parse a v0.x code fence info string ─────────────────────────────────────
// Input:  "js server/index.mjs focus=2,8 bg=3:5"
// Output: { language: "js", filename: "server/index.mjs", annotations: { focus: [...], bg: [...] } }
function parseInfoString(info) {
  info = info.trim()
  const annotations = {}

  // Extract annotations: focus=..., bg=..., mark=...
  info = info.replace(/\b(focus|bg|mark)=(\S+)/g, (_, name, spec) => {
    annotations[name] = parseRangeSpec(spec)
    return ''
  })

  // Remaining tokens: language [filename]
  const parts = info.trim().split(/\s+/).filter(Boolean)
  return {
    language: parts[0] || '',
    filename: parts.slice(1).join(' '),
    annotations,
  }
}

// ── JSON doesn't support comments — upgrade to jsonc so annotations work ───
function upgradeJsonLang(language) {
  return language === 'json' ? 'jsonc' : language
}

// ── Build v1 info string ────────────────────────────────────────────────────
function buildInfoString(language, filename) {
  if (filename) return `${language} ! ${filename}`
  return language
}

// ── Insert annotation comments into code lines ─────────────────────────────
// Works bottom-to-top so line indices stay valid after each insertion.
function insertAnnotations(codeLines, lang, annotations, warnings, context) {
  // Collect all insertions: { line, text }
  const insertions = []

  for (const [name, ranges] of Object.entries(annotations)) {
    // bg and mark handlers are registered in Scrollycoding.tsx — no warning needed

    for (const range of ranges) {
      let annot
      if (range.chars) {
        // Character-level annotation: mark=4[25:60]
        // In v1 this would be an inline annotation on the target line itself.
        // We approximate with a block annotation and warn.
        annot = makeAnnotation(lang, name, `[${range.chars}]`)
        warnings.push(`${context}: character range ${name}=${range.start}[${range.chars}] may need manual adjustment`)
      } else if (range.start === range.end) {
        annot = makeAnnotation(lang, name)
      } else {
        const count = range.end - range.start + 1
        annot = makeAnnotation(lang, name, `(1:${count})`)
      }
      insertions.push({ line: range.start, text: annot })
    }
  }

  // Sort descending so splicing doesn't affect earlier indices
  insertions.sort((a, b) => b.line - a.line)

  const result = [...codeLines]
  for (const ins of insertions) {
    const idx = ins.line - 1
    if (idx < 0 || idx >= result.length) {
      warnings.push(`${context}: annotation targets line ${ins.line} but code only has ${result.length} lines — skipped`)
      continue
    }
    const indent = result[idx].match(/^(\s*)/)?.[1] || ''
    result.splice(idx, 0, indent + ins.text)
  }
  return result
}

// ── Find a code fence in an array of lines ──────────────────────────────────
// Returns { start, end, ticks } or null. start = opening line, end = closing line.
function findCodeFence(lines, fromIdx = 0) {
  let start = -1
  let openTicks = ''

  for (let i = fromIdx; i < lines.length; i++) {
    const m = lines[i].match(/^(`{3,})(.*)$/)
    if (!m) continue

    if (start === -1) {
      start = i
      openTicks = m[1]
    } else if (m[1].length >= openTicks.length && m[2].trim() === '') {
      return { start, end: i, ticks: openTicks }
    }
  }
  return null
}

// ── Convert one scrollycoding step ──────────────────────────────────────────
function convertStep(stepContent, index, warnings) {
  stepContent = stepContent.trim()
  if (!stepContent) return null

  const lines = stepContent.split('\n')
  const fence = findCodeFence(lines)

  // Extract prose (everything before the code fence)
  const prose = fence
    ? lines.slice(0, fence.start).join('\n').trim()
    : stepContent.trim()

  // Derive a title from the first non-empty prose line
  const proseLines = prose.split('\n').filter(l => l.trim())
  let title = proseLines[0]?.trim() || `Step ${index + 1}`
  // Capitalize first letter, strip trailing period
  title = title.charAt(0).toUpperCase() + title.slice(1)
  title = title.replace(/\.$/, '')
  const body = proseLines.slice(1).join('\n').trim()

  let result = `## !!steps ${title}`
  if (body) result += '\n\n' + body

  if (fence) {
    const rawInfo = lines[fence.start].replace(/^`{3,}/, '')
    const { language: rawLang, filename, annotations } = parseInfoString(rawInfo)
    const language = Object.keys(annotations).length > 0 ? upgradeJsonLang(rawLang) : rawLang
    let codeLines = lines.slice(fence.start + 1, fence.end)

    const ctx = `Scrollycoding step ${index + 1}`
    codeLines = insertAnnotations(codeLines, language, annotations, warnings, ctx)

    const v1Info = buildInfoString(language, filename)
    result += `\n\n${fence.ticks}${v1Info}\n${codeLines.join('\n')}\n${fence.ticks}`
  }

  return result
}

// ── Convert a <CH.Scrollycoding> block ──────────────────────────────────────
function convertScrollyBlock(innerContent, warnings) {
  // Already converted to v1 format? Leave it alone.
  if (innerContent.includes('## !!steps')) {
    return '<CH.Scrollycoding>' + innerContent + '</CH.Scrollycoding>'
  }

  // Split by step separator: a blank-line-surrounded --- (or start/end of content)
  const rawSteps = innerContent.split(/\n---\n/)

  const steps = rawSteps
    .map((s, i) => convertStep(s, i, warnings))
    .filter(Boolean)

  return '<CH.Scrollycoding>\n\n' + steps.join('\n\n') + '\n\n</CH.Scrollycoding>'
}

// ── Convert a standalone annotated code fence ───────────────────────────────
function convertStandaloneFence(fullMatch, ticks, rawInfo, code, closeTicks, warnings) {
  const { language: rawLang, filename, annotations } = parseInfoString(rawInfo)

  // No v0.x annotations? Leave it alone.
  if (Object.keys(annotations).length === 0 && !filename) {
    return fullMatch
  }

  const language = upgradeJsonLang(rawLang)
  let codeLines = code.split('\n')
  codeLines = insertAnnotations(codeLines, language, annotations, warnings, `Standalone ${language} block`)

  const v1Info = filename ? buildInfoString(language, filename) : language
  return `${ticks}${v1Info}\n${codeLines.join('\n')}\n${closeTicks}`
}

// ── YAML frontmatter helpers ─────────────────────────────────────────────

/** Decide if a YAML string value needs quoting */
function yamlQuote(value) {
  if (typeof value !== 'string') return String(value)
  // Quote if it contains colons, quotes, or starts with special chars
  if (/[:\n#"']|^\s|^[{[]/.test(value)) {
    // Use single quotes, escaping internal single quotes by doubling
    return `'${value.replace(/'/g, "''")}'`
  }
  return value
}

/** Convert a parsed meta object → YAML frontmatter string (with --- delimiters) */
function metaToFrontmatter(meta) {
  const lines = ['---']
  // Emit fields in a stable order
  const fieldOrder = ['title', 'category', 'tags', 'date', 'updated', 'description']
  const emitted = new Set()

  for (const key of fieldOrder) {
    if (!(key in meta)) continue
    emitted.add(key)
    const val = meta[key]
    if (Array.isArray(val)) {
      lines.push(`${key}:`)
      for (const item of val) lines.push(`  - ${yamlQuote(item)}`)
    } else {
      lines.push(`${key}: ${yamlQuote(val)}`)
    }
  }
  // Any extra keys not in fieldOrder
  for (const [key, val] of Object.entries(meta)) {
    if (emitted.has(key)) continue
    if (Array.isArray(val)) {
      lines.push(`${key}:`)
      for (const item of val) lines.push(`  - ${yamlQuote(item)}`)
    } else {
      lines.push(`${key}: ${yamlQuote(val)}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

/** Extract and parse `export const meta = { ... }` from file content.
 *  Returns { meta, remaining } or null if no meta export found. */
function extractMeta(content) {
  // Match the meta export — may span multiple lines
  const metaMatch = content.match(/export\s+const\s+meta\s*=\s*(\{[\s\S]*?\n\})\s*\n/)
  if (!metaMatch) return null

  // Parse the JS object by evaluating it (safe: it's a static object literal from our own files)
  let meta
  try {
    meta = new Function(`return (${metaMatch[1]})`)()
  } catch {
    return null
  }

  let remaining = content.replace(metaMatch[0], '')

  // Remove ArticleLayout import
  remaining = remaining.replace(/import\s*\{?\s*ArticleLayout\s*\}?\s*from\s*['"][^'"]+['"]\s*\n?/g, '')

  // Remove default export that uses ArticleLayout
  remaining = remaining.replace(/export\s+default\s+props\s*=>\s*<ArticleLayout[^>]*>.*<\/ArticleLayout>\s*\n?/g, '')
  remaining = remaining.replace(/export\s+default\s+props\s*=>\s*<ArticleLayout[^\n]*\/>\s*\n?/g, '')
  remaining = remaining.replace(/export\s+default\s+props\s*=>\s*<ArticleLayout[^>]*>\s*\{[^}]*\}\s*<\/ArticleLayout>\s*\n?/g, '')

  // Trim leading blank lines
  remaining = remaining.replace(/^\n+/, '\n')

  return { meta, remaining }
}

// ── Main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const writeFlag = args.includes('--write')
const files = args.filter(a => !a.startsWith('--'))

if (files.length === 0) {
  console.error('Usage: node scripts/migrate-codehike.mjs <file.mdx> [...] [--write]')
  console.error('       --write   Modify files in place (default: print to stdout)')
  process.exit(1)
}

for (const file of files) {
  const warnings = []
  let content = fs.readFileSync(file, 'utf8')

  // ── Pass 0: Convert export const meta → YAML frontmatter ─────────────
  // Skip files that already have frontmatter
  if (!content.startsWith('---\n')) {
    const extracted = extractMeta(content)
    if (extracted) {
      const frontmatter = metaToFrontmatter(extracted.meta)
      content = frontmatter + '\n' + extracted.remaining
    }
  }

  // ── Pass 0b: Fix component imports ────────────────────────────────────
  // ~/components/Prose → ../components/Prose
  content = content.replace(
    /import\s*(\{[^}]+\})\s*from\s*'~\/components\/Prose'/g,
    "import $1 from '../components/Prose'",
  )

  // EditorWithConsole / EditorWithPreview → Editor
  content = content.replace(
    /import\s*\{\s*EditorWith(?:Console|Preview)\s*\}\s*from\s*'~\/components\/Editors'/g,
    "import { Editor } from '../components/Editor'",
  )

  // Deduplicate Editor imports (if both EditorWithConsole and EditorWithPreview were used)
  {
    const editorImport = "import { Editor } from '../components/Editor'"
    const lines = content.split('\n')
    let seen = false
    content = lines.filter(line => {
      if (line === editorImport) {
        if (seen) return false
        seen = true
      }
      return true
    }).join('\n')
  }

  // Remove next/dynamic import + dynamic() usage
  content = content.replace(/import\s+dynamic\s+from\s*'next\/dynamic'\s*\n?/g, '')
  content = content.replace(/export\s+const\s+\w+\s*=\s*dynamic\(.*\)\s*\n?/g, '')

  // <EditorWithConsole file={`...`} /> → <Editor console files={{ "/index.js": `...` }} />
  // Match from <EditorWithConsole to /> on its own line
  content = content.replace(
    /<EditorWithConsole\s*\n\s*file=\{([\s\S]*?)\}\s*\n\/>/g,
    (match, fileExpr) => {
      return `<Editor console\n  files={{ "/index.js": ${fileExpr.trim()} }}\n/>`
    },
  )

  // <EditorWithPreview → <Editor browser
  content = content.replace(/<EditorWithPreview/g, '<Editor browser')

  // In EditorWithPreview, options={{ editorHeight: ..., showConsole: true }} → height=... console
  content = content.replace(
    /\s*options=\{\{[\s\S]*?\}\}/g,
    (match) => {
      let result = ''
      const heightMatch = match.match(/editorHeight:\s*'([^']+)'/)
      if (heightMatch) result += `\n  height="${heightMatch[1]}"`
      if (match.includes('showConsole: true')) result += '\n  console'
      return result
    },
  )

  // ── Pass 1a: Convert <CH.Code> blocks → <CodeWithTabs> ────────────────
  // CH.Code wraps multiple code fences (optionally separated by ---) into tabs.
  // Each fence's info string "lang filename" → "lang !!tabs filename"
  content = content.replace(
    /<CH\.Code(?:\s+[^>]*)?>[\s\S]*?<\/CH\.Code>/g,
    (match) => {
      // Extract inner content (between opening and closing tags)
      const inner = match.replace(/<CH\.Code[^>]*>/, '').replace(/<\/CH\.Code>/, '')
      // Remove --- separators
      let cleaned = inner.replace(/\n---\n/g, '\n')
      // Add !!tabs to each code fence info string that has a filename
      cleaned = cleaned.replace(
        /^(`{3,})(\w+)\s+(!?\s*)(\S.*)/gm,
        (fMatch, ticks, lang, bang, rest) => {
          // Already has !!tabs? leave it alone
          if (rest.includes('!!tabs')) return fMatch
          // "lang ! filename" → "lang !!tabs filename"
          // "lang filename" → "lang !!tabs filename"
          const filename = rest.replace(/^!\s*/, '')
          return `${ticks}${lang} !!tabs ${filename}`
        },
      )
      return `<CodeWithTabs>\n${cleaned}\n</CodeWithTabs>`
    },
  )

  // ── Pass 1b: Convert <CH.Scrollycoding> blocks ─────────────────────────
  // Match: optional <div ...full-bleed...> wrapper, <CH.Scrollycoding ...props...>, content, closing tags
  content = content.replace(
    /(<CH\.Scrollycoding)(?:\s+[^>]*)?(>)([\s\S]*?)(<\/CH\.Scrollycoding>)/g,
    (_match, openTag, gt, inner, closeTag) => {
      return convertScrollyBlock(inner, warnings)
    },
  )

  // ── Pass 2: Convert standalone annotated code fences ───────────────────
  // Only convert fences that have v0.x annotations (focus=, bg=, mark=) in the info string.
  // Skip fences inside <CH.Scrollycoding> (already converted in pass 1).
  content = content.replace(
    /^(`{3,})(\S+[^\n]*(?:focus|bg|mark)=[^\n]*)\n([\s\S]*?)\n(`{3,})\s*$/gm,
    (match, ticks, info, code, closeTicks) => {
      return convertStandaloneFence(match, ticks, info, code, closeTicks, warnings)
    },
  )

  // ── Output ─────────────────────────────────────────────────────────────
  if (writeFlag) {
    fs.writeFileSync(file, content)
    console.error(`✓ ${file}`)
  } else {
    if (files.length > 1) console.log(`\n${'═'.repeat(60)}\n${file}\n${'═'.repeat(60)}`)
    process.stdout.write(content)
  }

  if (warnings.length > 0) {
    console.error(`\n  Warnings for ${file}:`)
    for (const w of warnings) {
      console.error(`    ⚠ ${w}`)
    }
  }
}
