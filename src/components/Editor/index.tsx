import { useState, useEffect, lazy, Suspense } from 'react'
import { EditorPlaceholder } from './EditorPlaceholder'
import {
  normalizeFiles,
  getLanguageFromPath,
  type EditorProps,
  type NormalizedFiles,
} from './types'

// Lazy load EditorClient so CodeMirror isn't evaluated during SSR
const EditorClient = lazy(() =>
  import('./EditorClient').then(mod => ({ default: mod.EditorClient })),
)

/**
 * Editor component that renders a static code placeholder on the server
 * and hydrates to an interactive editor on the client.
 *
 * @example Single file
 * ```mdx
 * <Editor files={{ "/index.js": `console.log("Hello")` }} console />
 * ```
 *
 * @example Multi-file editor with active file
 * ```mdx
 * <Editor
 *   template="react"
 *   browser
 *   files={{
 *     "/App.js": { code: `export default function App() { return <h1>Hi</h1> }`, active: true },
 *     "/utils.js": { code: `export const x = 1`, hidden: true }
 *   }}
 * />
 * ```
 */
export function Editor({
  files,
  template = 'vanilla',
  console: showConsole = false,
  browser: showBrowser = false,
  height = 300,
  dependencies,
  lineNumbers = true,
  readOnly = false,
  autorun = true,
}: EditorProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Normalize files from EditorFiles format
  const normalizedFiles: NormalizedFiles = normalizeFiles(files)

  // Prepare raw files for placeholder (visible files only)
  const rawFiles = Object.entries(normalizedFiles)
    .filter(([, file]) => !file.hidden)
    .map(([path, file]) => ({
      path,
      code: file.code,
      language: getLanguageFromPath(path),
      active: file.active,
    }))

  // SSR: Show static placeholder
  if (!mounted) {
    return (
      <EditorPlaceholder
        rawFiles={rawFiles}
        height={height}
        showConsole={showConsole}
        showBrowser={showBrowser}
      />
    )
  }

  // Client: Show interactive editor with Suspense fallback
  return (
    <Suspense
      fallback={
        <EditorPlaceholder
          rawFiles={rawFiles}
          height={height}
          showConsole={showConsole}
          showBrowser={showBrowser}
        />
      }
    >
      <EditorClient
        files={normalizedFiles}
        template={template}
        showConsole={showConsole}
        showBrowser={showBrowser}
        height={height}
        dependencies={dependencies}
        lineNumbers={lineNumbers}
        readOnly={readOnly}
        autorun={autorun}
      />
    </Suspense>
  )
}

export default Editor

// Re-export types for consumers
export type { EditorProps, EditorFiles, EditorFile } from './types'
