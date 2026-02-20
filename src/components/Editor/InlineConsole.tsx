import { useState, useEffect, useRef, useCallback } from 'react'
import { ObjectInspector } from 'react-inspector'
import { inspectorTheme } from './theme'

interface ConsoleLine {
  values: unknown[]
  type: 'log' | 'warn' | 'error'
}

interface InlineConsoleProps {
  code: string
  autorun: boolean
  horizontal?: boolean
}

function runCode(code: string): ConsoleLine[] {
  const lines: ConsoleLine[] = []
  const fakeConsole = {
    log: (...args: unknown[]) => lines.push({ values: args, type: 'log' }),
    warn: (...args: unknown[]) => lines.push({ values: args, type: 'warn' }),
    error: (...args: unknown[]) => lines.push({ values: args, type: 'error' }),
    info: (...args: unknown[]) => lines.push({ values: args, type: 'log' }),
  }
  try {
    const fn = new Function('console', code)
    fn(fakeConsole)
  } catch (err) {
    lines.push({ values: [String(err)], type: 'error' })
  }
  return lines
}

const lineBackground = {
  log: 'transparent',
  warn: 'var(--console-warn-bg)',
  error: 'var(--console-error-bg)',
}

export function InlineConsole({ code, autorun, horizontal }: InlineConsoleProps) {
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const [hasRun, setHasRun] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const execute = useCallback(() => {
    setLines(runCode(code))
    setHasRun(true)
  }, [code])

  // Auto-run on mount
  useEffect(() => {
    if (autorun) execute()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-run on code changes (debounced) after first run
  useEffect(() => {
    if (!hasRun) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(execute, 400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [code, execute, hasRun])

  return (
    <div
      style={{
        background: 'var(--editor-bg-subtle)',
        ...(horizontal
          ? { borderLeft: '1px solid var(--editor-border)', flex: 1, minWidth: 0, overflow: 'auto' }
          : { borderTop: '1px solid var(--editor-border)', flexShrink: 0 }),
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          height: 28,
          borderBottom: lines.length ? '1px solid var(--editor-border)' : 'none',
        }}
      >
        <span style={{ color: 'var(--editor-text-muted)', fontSize: 11 }}>Console</span>
        <button
          onClick={execute}
          style={{
            padding: '2px 10px',
            fontSize: 11,
            fontFamily: 'system-ui, sans-serif',
            background: 'var(--editor-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          Run
        </button>
      </div>

      {/* Output */}
      {lines.length > 0 && (
        <div
          style={{
            padding: '4px 0',
            fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
            fontSize: 12,
            lineHeight: 1.5,
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '1px 12px',
                background: lineBackground[line.type],
                borderBottom: '1px solid var(--console-line-border)',
              }}
            >
              {line.values.map((val, j) => (
                <ObjectInspector
                  key={j}
                  data={val}
                  theme={inspectorTheme as unknown as string}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
