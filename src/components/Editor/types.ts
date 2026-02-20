/**
 * File configuration for multi-file editors
 */
export interface EditorFile {
  /** The file content (code) */
  code: string
  /** Whether the file is hidden from the user (but still in sandbox) */
  hidden?: boolean
  /** Whether this file is the active/focused file */
  active?: boolean
  /** Whether this file is read-only */
  readOnly?: boolean
}

/**
 * Files can be specified as a simple string (just code) or as EditorFile object
 */
export type EditorFiles = Record<string, string | EditorFile>

/**
 * Normalized file format used internally
 */
export interface NormalizedFile {
  code: string
  hidden: boolean
  active: boolean
  readOnly: boolean
}

export type NormalizedFiles = Record<string, NormalizedFile>

/**
 * Props for the main Editor component
 */
export interface EditorProps {
  files: EditorFiles
  /** Template hint for WebContainer scaffolding (react, node, vanilla, etc.) */
  template?: string
  /** Show console panel (browser eval for simple JS) */
  console?: boolean
  /** Show browser preview panel (uses WebContainers) */
  browser?: boolean
  /** Editor height */
  height?: number | string
  /** NPM dependencies */
  dependencies?: Record<string, string>
  /** Show line numbers */
  lineNumbers?: boolean
  /** Read-only mode */
  readOnly?: boolean
  /** Auto-run code on changes */
  autorun?: boolean
}

/**
 * Props for the client-side editor wrapper
 */
export interface EditorClientProps {
  files: NormalizedFiles
  template: string
  showConsole: boolean
  showBrowser: boolean
  height: number | string
  dependencies?: Record<string, string>
  lineNumbers: boolean
  readOnly: boolean
  autorun: boolean
}

/**
 * Props for the SSR placeholder component
 */
export interface EditorPlaceholderProps {
  rawFiles: Array<{
    path: string
    code: string
    language: string
    active: boolean
  }>
  height: number | string
  showConsole: boolean
  showBrowser: boolean
}

/**
 * Utility to normalize files from EditorFiles format
 */
export function normalizeFiles(files: EditorFiles): NormalizedFiles {
  const normalized: NormalizedFiles = {}
  let hasActive = false

  for (const [path, file] of Object.entries(files)) {
    if (typeof file === 'string') {
      normalized[path] = {
        code: file,
        hidden: false,
        active: false,
        readOnly: false,
      }
    } else {
      normalized[path] = {
        code: file.code,
        hidden: file.hidden ?? false,
        active: file.active ?? false,
        readOnly: file.readOnly ?? false,
      }
      if (file.active) hasActive = true
    }
  }

  // If no active file specified, make first visible file active
  if (!hasActive) {
    const firstVisible = Object.keys(normalized).find(p => !normalized[p].hidden)
    if (firstVisible) {
      normalized[firstVisible].active = true
    }
  }

  return normalized
}

/**
 * Get language from file path
 */
export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'jsx'
    case 'ts':
    case 'tsx':
      return 'tsx'
    case 'css':
      return 'css'
    case 'html':
      return 'html'
    case 'json':
      return 'json'
    default:
      return 'javascript'
  }
}
