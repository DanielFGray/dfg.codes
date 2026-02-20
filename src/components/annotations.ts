import type { HighlightedCode } from 'codehike/code'

type BlockAnnotation = {
  name: string
  query: string
  fromLineNumber: number
  toLineNumber: number
}

type InlineAnnotation = {
  name: string
  query: string
  lineNumber: number
  fromColumn: number
  toColumn: number
}

/**
 * Parse a single range token into a block or inline annotation.
 *
 * Supported formats:
 *   "3"        → block line 3
 *   "3:5"      → block lines 3–5
 *   "4[25:60]" → inline on line 4, columns 25–60
 */
function parseAnnotationRange(name: string, token: string): BlockAnnotation | InlineAnnotation {
  // Inline: "4[25:60]"
  const inlineMatch = token.match(/^(\d+)\[(\d+):(\d+)\]$/)
  if (inlineMatch) {
    return {
      name,
      query: '',
      lineNumber: parseInt(inlineMatch[1], 10),
      fromColumn: parseInt(inlineMatch[2], 10),
      toColumn: parseInt(inlineMatch[3], 10),
    }
  }

  // Block: "3" or "3:5"
  const [startStr, endStr] = token.split(':')
  const from = parseInt(startStr, 10)
  const to = endStr ? parseInt(endStr, 10) : from
  return { name, query: '', fromLineNumber: from, toLineNumber: to }
}

/** Parse a comma-separated annotation value like "1,3:5,4[25:60]" */
export function parseMetaAnnotations(name: string, value: string) {
  return value.split(',').map(token => parseAnnotationRange(name, token))
}

/**
 * Parse all supported meta annotations (focus=, mark=, bg=) from a
 * HighlightedCode's meta string and inject them into the annotations array.
 * Annotations referencing lines beyond the code block are silently dropped.
 */
export function withMetaAnnotations(cb: HighlightedCode): HighlightedCode {
  const meta = cb.meta || ''
  let annotations = [...(cb.annotations || [])]
  const totalLines = cb.code.split('\n').length

  for (const [, rawName, value] of meta.matchAll(/\b(focus|mark|bg)=(\S+)/g)) {
    // bg is a legacy alias for mark
    const name = rawName === 'bg' ? 'mark' : rawName
    const parsed = parseMetaAnnotations(name, value)
      .filter(a => {
        if ('lineNumber' in a) return a.lineNumber <= totalLines
        return a.fromLineNumber <= totalLines
      })
      .map(a => {
        if (!('lineNumber' in a) && a.toLineNumber > totalLines) {
          return { ...a, toLineNumber: totalLines }
        }
        return a
      })
    annotations = [...annotations, ...parsed]
  }

  return annotations.length === (cb.annotations?.length ?? 0) ? cb : { ...cb, annotations }
}

/** Extract a filename/label from a HighlightedCode's meta string */
export function getCodeblockLabel(cb: HighlightedCode): string {
  const meta = cb.meta || ''
  const parts = meta.split(/\s+/)
  const label = parts.find(p => p && !p.includes('='))
  return label || ''
}
