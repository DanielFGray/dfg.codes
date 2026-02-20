import { useState } from 'react'
import type { EditorPlaceholderProps } from './types'

/**
 * SSR Placeholder for the Editor component.
 * Renders a static code block with syntax highlighting (or fallback)
 * that will be replaced by the interactive editor on the client.
 */
export function EditorPlaceholder({
  rawFiles,
  height,
  showConsole,
  showBrowser,
}: EditorPlaceholderProps) {
  const [activeTab, setActiveTab] = useState(() => {
    const active = rawFiles.find(f => f.active)
    return active?.path ?? rawFiles[0]?.path ?? ''
  })

  const heightStyle = typeof height === 'number' ? `${height}px` : height
  const hasMultipleFiles = rawFiles.length > 1

  return (
    <div
      className="editor-placeholder overflow-hidden rounded-lg border border-zinc-200 bg-zinc-900 dark:border-zinc-700"
      style={{ height: heightStyle }}
    >
      {/* Header with file tabs and panel indicators */}
      <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-2">
        {/* File tabs */}
        <div className="flex">
          {rawFiles.map(file => (
            <button
              key={file.path}
              onClick={() => setActiveTab(file.path)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === file.path
                  ? 'border-b-2 border-blue-500 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {file.path.replace(/^\//, '')}
            </button>
          ))}
        </div>

        {/* Panel indicators */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {showBrowser && (
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              Preview
            </span>
          )}
          {showConsole && (
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Console
            </span>
          )}
        </div>
      </div>

      {/* Code content */}
      <div
        className="overflow-auto"
        style={{ height: `calc(${heightStyle} - ${hasMultipleFiles ? '80px' : '48px'})` }}
      >
        {rawFiles.map(file => (
          <div key={file.path} className={activeTab === file.path ? 'block' : 'hidden'}>
            <pre className="m-0 overflow-auto bg-zinc-900 p-4 text-sm leading-relaxed">
              <code className={`language-${file.language} text-zinc-300`}>{file.code}</code>
            </pre>
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      <div className="flex items-center justify-center border-t border-zinc-700 bg-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading interactive editor...</span>
        </div>
      </div>
    </div>
  )
}
