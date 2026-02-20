import { useEffect, useRef, useState, useCallback } from 'react'
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
  const draggingRef = useRef(false)
  const runningRef = useRef(false)
  const filesRef = useRef(files)
  filesRef.current = files
  const idRef = useRef(++nextId)
  const myId = idRef.current

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

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newHeight = containerRect.bottom - e.clientY
      setTerminalHeight(Math.max(40, Math.min(newHeight, containerRect.height - 60)))
    }
    function onMouseUp() {
      if (draggingRef.current) {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

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

  function handleRun() {
    handleRunRef.current()
  }

  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    draggingRef.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

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
              onMouseDown={startDrag}
              style={{ height: 5, cursor: 'row-resize', background: 'var(--editor-bg-subtle)', borderTop: '1px solid var(--editor-border)', flexShrink: 0 }}
            />
          )}

          <div
            onClick={() => setTerminalOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center',
              background: 'var(--editor-bg-subtle)',
              borderTop: terminalOpen ? 'none' : '1px solid var(--editor-border)',
              padding: '0 8px', height: 24, cursor: 'pointer', userSelect: 'none', flexShrink: 0,
            }}
          >
            <span style={{ color: 'var(--editor-text-muted)', fontSize: 10, marginRight: 4 }}>
              {terminalOpen ? '\u25BC' : '\u25B6'}
            </span>
            <span style={{ color: 'var(--editor-text-muted)', fontSize: 11 }}>Terminal</span>
          </div>

          {terminalOpen && (
            <div
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
