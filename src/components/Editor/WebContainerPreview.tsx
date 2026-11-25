import { useEffect, useRef, useState, useCallback } from 'react'
import { mergeProps, useFocusRing, useMove, useSeparator } from 'react-aria'
import { Button } from 'react-aria-components'
import type { NormalizedFiles } from './types'

interface WebContainerPreviewProps {
  files: NormalizedFiles
  template?: string
  dependencies?: Record<string, string>
}

// ── Singleton hidden iframe: boots WebContainer once, never moves in DOM ──
let sharedIframe: HTMLIFrameElement | null = null
let iframeReady = false
let pendingMessage: unknown = null

function ensureIframe(): HTMLIFrameElement {
  if (!sharedIframe) {
    sharedIframe = document.createElement('iframe')
    sharedIframe.src = '/node-preview.html'
    sharedIframe.title = 'WebContainer Runtime'
    Object.assign(sharedIframe.style, {
      position: 'fixed',
      width: '0',
      height: '0',
      border: 'none',
      opacity: '0',
      pointerEvents: 'none',
    })
    document.body.appendChild(sharedIframe)

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'ready') {
        iframeReady = true
        if (pendingMessage) {
          sharedIframe?.contentWindow?.postMessage(pendingMessage, '*')
          pendingMessage = null
        } else {
          sharedIframe?.contentWindow?.postMessage({ type: 'warmup' }, '*')
        }
      }
    })
  }
  return sharedIframe
}

function postToIframe(msg: unknown) {
  ensureIframe()
  if (iframeReady && sharedIframe?.contentWindow) {
    sharedIframe.contentWindow.postMessage(msg, '*')
  } else {
    pendingMessage = msg
  }
}

// Pre-warm: create iframe eagerly so WebContainer boots while user reads
if (typeof window !== 'undefined') {
  setTimeout(ensureIframe, 100)
}

// ── Takeover coordination ──
const TAKEOVER_EVENT = 'wc-preview-takeover'
let nextId = 0

interface EditorEntry {
  el: React.RefObject<HTMLDivElement | null>
  run: React.RefObject<() => void>
  isRunning: React.RefObject<boolean>
}
const editors = new Map<number, EditorEntry>()

function runMostVisible() {
  let bestId = -1
  let bestRatio = 0
  for (const [id, entry] of editors) {
    if (entry.isRunning.current) continue
    const el = entry.el.current
    if (!el) continue
    const rect = el.getBoundingClientRect()
    if (rect.height === 0) continue
    const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
    const ratio = visible / rect.height
    if (ratio > bestRatio) {
      bestRatio = ratio
      bestId = id
    }
  }
  if (bestId >= 0 && bestRatio >= 0.2) {
    editors.get(bestId)?.run.current?.()
  }
}

interface TerminalLine {
  text: string
  type: string
}

export function WebContainerPreview({
  files,
  template = 'node',
  dependencies,
}: WebContainerPreviewProps) {
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [terminalHeight, setTerminalHeight] = useState(120)
  const terminalRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const runningRef = useRef(false)
  const filesRef = useRef(files)
  filesRef.current = files
  const idRef = useRef(++nextId)
  const myId = idRef.current
  const terminalId = `wc-preview-terminal-${myId}`

  const sendFiles = useCallback(() => {
    const plain: Record<string, string> = {}
    for (const [path, fileData] of Object.entries(filesRef.current)) {
      plain[path] = fileData.code
    }
    postToIframe({ type: 'mount', files: plain, template, dependencies })
  }, [template, dependencies])

  runningRef.current = running

  const handleRunRef = useRef(() => {})
  handleRunRef.current = () => {
    window.dispatchEvent(new CustomEvent(TAKEOVER_EVENT, { detail: myId }))
    setStatus('Booting...')
    setLines([])
    setPreviewUrl(null)
    setRunning(true)
    sendFiles()
  }

  const unloadRef = useRef(() => {})
  unloadRef.current = () => {
    setRunning(false)
    setStatus('')
    setLines([])
    setPreviewUrl(null)
  }

  useEffect(() => {
    editors.set(myId, { el: rootRef, run: handleRunRef, isRunning: runningRef })
    return () => { editors.delete(myId) }
  }, [myId])

  useEffect(() => {
    if (!running) return
    function onMessage(event: MessageEvent) {
      const data = event.data
      if (!data) return
      switch (data.type) {
        case 'wc-status':
          setStatus(data.text)
          break
        case 'wc-terminal':
          setLines(prev => [...prev.slice(-199), { text: data.text, type: data.lineType }])
          break
        case 'wc-server-ready':
          setPreviewUrl(data.url)
          setStatus('')
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [running])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [lines])

  const terminalHeightRef = useRef(terminalHeight)
  terminalHeightRef.current = terminalHeight

  // The handle between the preview and the terminal: pointer drags and arrow
  // keys both go through useMove's onMove (keyboard moves arrive as deltas of
  // ±1 per keypress, with key repeat producing a stream of them).
  const { moveProps } = useMove({
    onMoveStart() {
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    },
    onMove(e) {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return
      // The handle sits on top of the terminal, so the separator follows the
      // pointer: moving up (deltaY negative) grows the terminal, unlike the
      // dfg.rocks sidebar whose resized pane sits before the handle.
      const next = Math.max(
        40,
        Math.min(terminalHeightRef.current - e.deltaY, containerRect.height - 60),
      )
      terminalHeightRef.current = next
      setTerminalHeight(next)
    },
    onMoveEnd() {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    },
  })
  const { separatorProps } = useSeparator({ orientation: 'horizontal' })
  const { focusProps, isFocusVisible } = useFocusRing()

  // ARIA defaults an absent aria-valuemax to 100, which the terminal height
  // can exceed, so the separator reports the same max the resize clamp uses.
  // The max is layout-dependent; the observer keeps it true across drags and
  // window resizes.
  const [maxHeight, setMaxHeight] = useState(terminalHeight)
  useEffect(() => {
    const container = containerRef.current
    if (!running || !container) return
    const update = () => {
      const max = container.getBoundingClientRect().height - 60
      setMaxHeight(max)
      // A window shrink can leave the terminal taller than the new max; the
      // range must stay true without waiting for a drag to re-clamp it.
      setTerminalHeight(prev => Math.max(40, Math.min(prev, max)))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [running])

  function handleRun() {
    handleRunRef.current()
  }

  useEffect(() => {
    function onTakeover(e: Event) {
      if ((e as CustomEvent).detail !== myId && runningRef.current) {
        unloadRef.current()
      }
    }
    window.addEventListener(TAKEOVER_EVENT, onTakeover)
    return () => window.removeEventListener(TAKEOVER_EVENT, onTakeover)
  }, [myId])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.5 && !runningRef.current) {
          setTimeout(() => {
            if (!runningRef.current) runMostVisible()
          }, 300)
        }
        if (entry.intersectionRatio < 0.1 && runningRef.current) {
          unloadRef.current()
          setTimeout(runMostVisible, 50)
        }
      },
      { threshold: [0.1, 0.5] },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={rootRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--editor-bg-subtle)',
        borderLeft: '1px solid var(--editor-border)',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {!running ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={handleRun}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif',
              background: 'var(--editor-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Run
          </button>
        </div>
      ) : (
        <>
          <div ref={containerRef} style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title="Preview"
                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--editor-text-muted)', fontSize: 13 }}>
                {status || 'Loading...'}
              </div>
            )}
          </div>

          {terminalOpen && (
            <div
              {...mergeProps(moveProps, separatorProps, focusProps)}
              tabIndex={0}
              aria-label="Resize terminal"
              aria-valuenow={terminalHeight}
              aria-valuemin={40}
              aria-valuemax={maxHeight}
              style={{
                height: 5, cursor: 'row-resize', background: 'var(--editor-bg-subtle)',
                borderTop: '1px solid var(--editor-border)', flexShrink: 0, touchAction: 'none',
                outline: isFocusVisible ? '1px solid var(--editor-accent)' : 'none',
                outlineOffset: -1,
              }}
            />
          )}

          <Button
            aria-expanded={terminalOpen}
            aria-controls={terminalId}
            onPress={() => setTerminalOpen(o => !o)}
            style={({ isFocusVisible: focused }) => ({
              display: 'flex', alignItems: 'center', width: '100%',
              background: 'var(--editor-bg-subtle)',
              border: 'none',
              borderTop: terminalOpen ? 'none' : '1px solid var(--editor-border)',
              padding: '0 8px', height: 24, cursor: 'pointer', userSelect: 'none', flexShrink: 0,
              font: 'inherit', textAlign: 'left',
              outline: focused ? '1px solid var(--editor-accent)' : 'none',
              outlineOffset: -1,
            })}
          >
            <span style={{ color: 'var(--editor-text-muted)', fontSize: 10, marginRight: 4 }}>
              {terminalOpen ? '\u25BC' : '\u25B6'}
            </span>
            <span style={{ color: 'var(--editor-text-muted)', fontSize: 11 }}>Terminal</span>
          </Button>

          {terminalOpen && (
            <div
              id={terminalId}
              ref={terminalRef}
              style={{
                height: terminalHeight, overflow: 'auto',
                background: 'var(--editor-bg-subtle)', padding: '4px 12px',
                fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
                fontSize: 12, lineHeight: 1.5, flexShrink: 0,
              }}
            >
              {lines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: line.type === 'stderr' ? '#ff6b6b' : line.type === 'system' ? 'var(--syntax-string)' : 'var(--editor-text)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}
                >
                  {line.text}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
