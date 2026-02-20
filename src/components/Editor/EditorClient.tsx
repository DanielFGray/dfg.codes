import { useState, useEffect, useRef, useCallback } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { editorExtension } from './theme'
import { InlineConsole } from './InlineConsole'
import { WebContainerPreview } from './WebContainerPreview'
import type { EditorClientProps, NormalizedFiles } from './types'

function langExtension(path: string) {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'js':
    case 'jsx':
      return javascript({ jsx: true })
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'css':
      return css()
    case 'html':
      return html()
    case 'json':
      return json()
    default:
      return javascript()
  }
}

/**
 * Client-side editor component.
 * Uses CodeMirror for the code editor, browser eval for console, WebContainers for preview.
 */
export function EditorClient({
  files,
  template,
  showConsole,
  showBrowser,
  height,
  dependencies,
  lineNumbers,
  readOnly,
  autorun,
}: EditorClientProps) {
  const visibleFiles = Object.entries(files).filter(([, f]) => !f.hidden)
  const [activeTab, setActiveTab] = useState(() => {
    const active = visibleFiles.find(([, f]) => f.active)
    return active?.[0] ?? visibleFiles[0]?.[0] ?? ''
  })

  // Track live code for all files (including hidden ones for WebContainer)
  const [liveFiles, setLiveFiles] = useState<NormalizedFiles>(files)
  const updateFile = useCallback((path: string, code: string) => {
    setLiveFiles(prev => ({
      ...prev,
      [path]: { ...prev[path], code },
    }))
  }, [])

  const heightStyle = typeof height === 'number' ? `${height}px` : height
  const showTabs = visibleFiles.length > 1

  // Collect all code for console eval (concatenate visible files)
  const activeCode = liveFiles[activeTab]?.code ?? ''

  return (
    <div
      className="editor-container"
      style={{
        height: heightStyle,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--editor-border)',
        background: 'var(--editor-bg)',
      }}
    >
      {/* Tab bar */}
      {showTabs && (
        <div
          style={{
            display: 'flex',
            background: 'var(--editor-bg-subtle)',
            borderBottom: '1px solid var(--editor-border)',
            flexShrink: 0,
          }}
        >
          {visibleFiles.map(([path]) => (
            <button
              key={path}
              onClick={() => setActiveTab(path)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontFamily: 'system-ui, sans-serif',
                background: activeTab === path ? 'var(--editor-bg)' : 'transparent',
                color: activeTab === path ? 'var(--editor-text)' : 'var(--editor-text-muted)',
                border: 'none',
                borderBottom: activeTab === path ? '2px solid var(--editor-accent)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {path.replace(/^\//, '')}
            </button>
          ))}
        </div>
      )}

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: showBrowser ? 'row' : 'column',
          minHeight: 0,
        }}
      >
        {/* Code editor */}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {visibleFiles.map(([path]) => (
            <div
              key={path}
              style={{
                display: activeTab === path ? 'flex' : 'none',
                flex: 1,
                minHeight: 0,
              }}
            >
              <CodeMirrorEditor
                code={files[path].code}
                path={path}
                readOnly={readOnly}
                lineNumbers={lineNumbers}
                onChange={code => updateFile(path, code)}
              />
            </div>
          ))}
        </div>

        {/* Console (browser eval) */}
        {showConsole && !showBrowser && (
          <InlineConsole code={activeCode} autorun={autorun} />
        )}

        {/* Browser preview (WebContainers) */}
        {showBrowser && (
          <WebContainerPreview
            files={liveFiles}
            template={template}
            dependencies={dependencies}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Individual CodeMirror instance for a single file tab.
 */
function CodeMirrorEditor({
  code,
  path,
  readOnly,
  lineNumbers,
  onChange,
}: {
  code: string
  path: string
  readOnly: boolean
  lineNumbers: boolean
  onChange: (code: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        langExtension(path),
        ...editorExtension,
        EditorView.lineWrapping,
        ...(readOnly ? [EditorState.readOnly.of(true)] : []),
        ...(!lineNumbers ? [EditorView.editorAttributes.of({ class: 'hide-gutters' })] : []),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
      }}
    />
  )
}
