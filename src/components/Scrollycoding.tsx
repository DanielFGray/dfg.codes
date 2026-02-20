import { z } from 'zod/v4'
import { Selectable, SelectionProvider, useSelectedIndex } from 'codehike/utils/selection'
import { Block, CodeBlock, parseRoot, parseProps } from 'codehike/blocks'
import { HighlightedCode, Pre, RawCode, highlight } from 'codehike/code'
import { tokenTransitions } from '@/components/token-transitions'
import { focus } from '@/components/focus'
import { mark } from '@/components/mark'
import {
  getCodeblockLabel,
  withMetaAnnotations,
  parseMetaAnnotations,
} from '@/components/annotations'
import React, { ReactNode, useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'

// ---------------------------------------------------------------------------
// V1 Scrollycoding (uses ## !!steps block syntax)
// ---------------------------------------------------------------------------

const Schema = Block.extend({
  steps: z.array(Block.extend({ code: CodeBlock })),
})

type Step = {
  title: string
  children: ReactNode
  code: RawCode
}

type HighlightedStep = {
  title: string
  children: ReactNode
  code: HighlightedCode
}

/**
 * Root-level Scrollycoding component.
 * Use this when the entire page is a scrollycoding layout.
 * The content should use `## !!steps` syntax at the root of the MDX.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Scrollycoding({ content: Content }: { content: any }) {
  const { steps } = useMemo(() => parseRoot(Content, Schema) as { steps: Step[] }, [Content])
  return <ScrollycodingInner steps={steps} />
}

/**
 * Inline Scrollycoding component.
 * Use this as `<Scrollycoding>...</Scrollycoding>` within MDX content.
 * Children should use `## !!steps` syntax.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InlineScrollycoding(props: any) {
  const { steps } = useMemo(() => parseProps(props, Schema) as { steps: Step[] }, [props])
  return <ScrollycodingInner steps={steps} />
}

function ScrollycodingInner({ steps }: { steps: Step[] }) {
  const [highlightedSteps, setHighlightedSteps] = useState<HighlightedStep[] | null>(null)

  useEffect(() => {
    let cancelled = false
    async function highlightAll() {
      const codes = await Promise.all(steps.map(step => highlight(step.code, 'github-dark')))
      if (!cancelled) {
        setHighlightedSteps(
          steps.map((step, i) => ({
            title: step.title,
            children: step.children,
            code: codes[i],
          })),
        )
      }
    }
    highlightAll()
    return () => {
      cancelled = true
    }
  }, [steps])

  if (!highlightedSteps) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-lg text-gray-500">Loading code...</div>
      </div>
    )
  }

  return (
    <SelectionProvider className="flex gap-4" rootMargin={{ top: 200, height: 100 }}>
      <div className="prose mb-[90vh] ml-2 mt-32 flex-1 dark:prose-invert">
        {highlightedSteps.map((step, i) => (
          <Selectable
            key={i}
            index={i}
            selectOn={['click', 'scroll']}
            className="mb-24 rounded border-l-4 border-gray-300 bg-gray-100 px-5 py-2 data-[selected=true]:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:data-[selected=true]:border-blue-400"
          >
            <h2 className="mt-4 text-xl">{step.title}</h2>
            <div>{step.children}</div>
          </Selectable>
        ))}
      </div>
      <div className="w-[40vw] max-w-xl bg-gray-100 dark:bg-gray-800">
        <div className="sticky top-16 overflow-auto">
          <V1CodePanel steps={highlightedSteps} />
        </div>
      </div>
    </SelectionProvider>
  )
}

function V1CodePanel({ steps }: { steps: HighlightedStep[] }) {
  const [selectedIndex] = useSelectedIndex()
  const codeblock = steps[selectedIndex]?.code ?? steps[0]?.code

  return (
    <Pre
      code={codeblock}
      handlers={[focus, mark, tokenTransitions]}
      className="min-h-[40rem] overflow-auto rounded-lg p-4"
    />
  )
}

// ---------------------------------------------------------------------------
// Helpers for parsing v0-style CH component children
// ---------------------------------------------------------------------------

/** Split React children into groups at each <hr> separator */
function splitByHr(children: ReactNode): ReactNode[][] {
  const groups: ReactNode[][] = [[]]
  React.Children.forEach(children, child => {
    if (React.isValidElement(child) && child.type === 'hr') {
      groups.push([])
    } else {
      groups[groups.length - 1].push(child)
    }
  })
  return groups.filter(g => g.length > 0)
}

/** Check if a React element is a Code component (has codeblock prop) */
function isCodeElement(child: ReactNode): child is React.ReactElement<{ codeblock: HighlightedCode }> {
  return React.isValidElement(child) && child.props != null && 'codeblock' in child.props
}

/** Check if a code element has actual content (non-empty) */
function isNonEmptyCode(child: React.ReactElement<{ codeblock: HighlightedCode }>): boolean {
  const cb = child.props.codeblock
  // Check if the code has actual lines/content
  if (!cb) return false
  if ('lines' in cb && Array.isArray(cb.lines)) return cb.lines.length > 0
  if ('value' in cb && typeof cb.value === 'string') return cb.value.trim().length > 0
  return true
}

/** Separate a group of React elements into prose and all code elements */
function separateProseAndCode(
  elements: ReactNode[],
): { prose: ReactNode[]; codeElements: React.ReactElement<{ codeblock: HighlightedCode }>[] } {
  const prose: ReactNode[] = []
  const codeElements: React.ReactElement<{ codeblock: HighlightedCode }>[] = []
  for (const el of elements) {
    if (isCodeElement(el)) {
      codeElements.push(el)
    } else {
      prose.push(el)
    }
  }
  return { prose, codeElements }
}

// ---------------------------------------------------------------------------
// Accumulated file tracking for v0 compat (scrollycoding / spotlight)
// ---------------------------------------------------------------------------

type V0Step = {
  prose: ReactNode[]
  files: Record<string, HighlightedCode>
  activeFile: string
}

/**
 * Build steps that accumulate files across groups.
 * Each step carries forward all previously-seen files, and applies
 * per-step focus annotations from meta strings.
 */
function buildAccumulatedSteps(groups: ReactNode[][]): V0Step[] {
  const accumulatedFiles: Record<string, HighlightedCode> = {}
  let lastActiveFile = ''

  return groups.map(group => {
    const { prose, codeElements } = separateProseAndCode(group)
    let activeFile = lastActiveFile

    // Process each code element — update accumulated base files
    for (const codeEl of codeElements) {
      const cb = codeEl.props.codeblock
      const filename = getCodeblockLabel(cb) || lastActiveFile

      if (isNonEmptyCode(codeEl)) {
        accumulatedFiles[filename] = cb
      }

      activeFile = filename
    }

    // Snapshot accumulated files for this step
    const files: Record<string, HighlightedCode> = { ...accumulatedFiles }

    // Apply meta annotations (focus, mark, bg) from this step's code elements
    for (const codeEl of codeElements) {
      const cb = codeEl.props.codeblock
      const filename = getCodeblockLabel(cb) || lastActiveFile
      if (files[filename]) {
        const annotated = withMetaAnnotations(cb)
        const newAnnotations = annotated.annotations.slice(cb.annotations?.length ?? 0)
        if (newAnnotations.length > 0) {
          files[filename] = {
            ...files[filename],
            annotations: [...(files[filename].annotations || []), ...newAnnotations],
          }
        }
      }
    }

    lastActiveFile = activeFile
    return { prose, files, activeFile }
  })
}

/** Render a single code block with filename header and focus support */
function CodeBlockWithHeader({ codeblock }: { codeblock: HighlightedCode }) {
  const label = getCodeblockLabel(codeblock)
  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-primary-200 bg-[var(--ch-16)] shadow-md dark:border-primary-700/30">
      {label && (
        <div className="border-b border-primary-200 bg-[var(--ch-22)] px-4 py-1.5 font-mono text-xs text-primary-500 dark:border-primary-700/30 dark:text-primary-400">
          {label}
        </div>
      )}
      <Pre
        code={withMetaAnnotations(codeblock)}
        handlers={[focus, mark]}
        className="my-0 overflow-auto rounded-none p-4"
      />
    </div>
  )
}

function CHCode({ children }: { children?: ReactNode }) {
  const [activeTab, setActiveTab] = useState(0)
  const groups = useMemo(() => splitByHr(children), [children])

  // Extract codeblocks from all groups, injecting focus annotations from meta
  const codeblocks = useMemo(() => {
    return groups.map(group => {
      const codeEl = group.find(isCodeElement)
      if (!codeEl) return null
      const cb = (codeEl as React.ReactElement<{ codeblock: HighlightedCode }>).props.codeblock
      return withMetaAnnotations(cb)
    })
  }, [groups])

  if (groups.length <= 1) {
    const cb = codeblocks[0]
    if (cb) return <CodeBlockWithHeader codeblock={cb} />
    return <div className="not-prose my-4">{children}</div>
  }

  const labels = codeblocks.map((cb, i) =>
    cb ? getCodeblockLabel(cb) || `Tab ${i + 1}` : `Tab ${i + 1}`,
  )

  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-primary-200 bg-[var(--ch-16)] shadow-md dark:border-primary-700/30">
      <div className="flex border-b border-primary-200 bg-[var(--ch-22)] text-sm dark:border-primary-700/30">
        {labels.map((label, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={clsx(
              'px-4 py-2 font-mono transition-colors',
              activeTab === i
                ? 'border-b-2 border-secondary-400 text-primary-100'
                : 'text-primary-500 hover:text-primary-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {codeblocks.map((cb, i) =>
        cb ? (
          <div key={i} className={activeTab === i ? 'block' : 'hidden'}>
            <Pre
              code={cb}
              handlers={[focus, mark]}
              className="my-0 overflow-auto rounded-none p-4"
            />
          </div>
        ) : (
          <div key={i} className={clsx(activeTab === i ? 'block' : 'hidden', 'p-4')}>
            {groups[i]}
          </div>
        ),
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CH.Scrollycoding — Scroll-synced prose + code (v0 compat)
// Full-bleed: breaks out of article-layout grid to use full viewport width.
// ---------------------------------------------------------------------------

function CHScrollycoding({
  children,
  rows,
}: {
  children?: ReactNode
  className?: string
  rows?: number
}) {
  const groups = useMemo(() => splitByHr(children), [children])
  const steps = useMemo(() => buildAccumulatedSteps(groups), [groups])

  const maxH = rows ? `${rows * 1.5}rem` : '80vh'

  return (
    <SelectionProvider
      className="full-bleed not-prose flex gap-6 px-4 sm:px-8"
      rootMargin={{ top: 200, height: 100 }}
    >
      <div className="mb-[90vh] mt-4 w-1/2">
        {steps.map((step, i) => (
          <Selectable
            key={i}
            index={i}
            selectOn={['click', 'scroll']}
            className={clsx(
              'mb-24 rounded-md border-l-4 px-5 py-2 transition-colors',
              'border-zinc-300 bg-zinc-100',
              'data-[selected=true]:border-secondary-500 data-[selected=true]:bg-zinc-200',
              'dark:border-zinc-600 dark:bg-zinc-800/50',
              'dark:data-[selected=true]:border-secondary-400 dark:data-[selected=true]:bg-zinc-800',
            )}
          >
            <div className="prose dark:prose-invert">{step.prose}</div>
          </Selectable>
        ))}
      </div>
      <div className="w-1/2">
        <div className="sticky top-16">
          <V0CodePanel steps={steps} maxHeight={maxH} />
        </div>
      </div>
    </SelectionProvider>
  )
}

/** Tabbed code panel that accumulates files across steps */
function V0CodePanel({ steps, maxHeight }: { steps: V0Step[]; maxHeight?: string }) {
  const [selectedIndex] = useSelectedIndex()
  const step = steps[selectedIndex] ?? steps[0]

  // Track which step the user's tab override belongs to —
  // auto-clears when selectedIndex changes (no useEffect race).
  const [tabState, setTabState] = useState<{ tab: string; forStep: number } | null>(null)
  const userTab = tabState?.forStep === selectedIndex ? tabState.tab : null

  if (!step) return <div className="min-h-[40rem] rounded-lg" />

  const filenames = Object.keys(step.files).filter(Boolean)
  const activeFile = userTab && step.files[userTab] ? userTab : step.activeFile
  const codeblock = step.files[activeFile]

  if (!codeblock) return <div className="min-h-[40rem] rounded-lg" />

  return (
    <div className="overflow-hidden rounded-lg border border-primary-200 bg-[var(--ch-16)] shadow-md dark:border-primary-700/30">
      {filenames.length > 1 && (
        <div className="flex overflow-x-auto border-b border-primary-200 bg-[var(--ch-22)] dark:border-primary-700/30">
          {filenames.map(name => (
            <button
              type="button"
              key={name}
              onClick={e => {
                e.stopPropagation()
                setTabState({ tab: name, forStep: selectedIndex })
              }}
              className={clsx(
                'whitespace-nowrap px-3 py-1.5 font-mono text-xs transition-colors',
                name === activeFile
                  ? 'border-b-2 border-secondary-400 text-primary-100'
                  : 'text-primary-500 hover:text-primary-300',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <Pre
        code={codeblock}
        handlers={[tokenTransitions, focus, mark]}
        className="my-0 overflow-auto rounded-none p-4"
        style={maxHeight ? { maxHeight } : undefined}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CH.Spotlight — Click-based selection with code (v0 compat)
// Full-bleed like scrollycoding.
// ---------------------------------------------------------------------------

function CHSpotlight({
  children,
  className,
  rows,
}: {
  children?: ReactNode
  className?: string
  rows?: number
}) {
  const isHorizontal = className?.includes('horizontal')
  const groups = useMemo(() => splitByHr(children), [children])
  const steps = useMemo(() => buildAccumulatedSteps(groups), [groups])

  const maxH = rows ? `${rows * 1.5}rem` : '80vh'

  if (isHorizontal) {
    return (
      <SelectionProvider className="full-bleed not-prose flex flex-col gap-4 px-4 sm:px-8">
        <div className="flex flex-wrap gap-2">
          {steps.map((step, i) => (
            <Selectable
              key={i}
              index={i}
              selectOn={['click']}
              className={clsx(
                'cursor-pointer rounded-md border px-4 py-2 transition-colors',
                'border-zinc-700 bg-zinc-900 text-zinc-300',
                'hover:bg-zinc-800',
                'data-[selected=true]:border-secondary-400 data-[selected=true]:text-white',
              )}
            >
              <div className="prose prose-sm dark:prose-invert">{step.prose}</div>
            </Selectable>
          ))}
        </div>
        <div>
          <V0CodePanel steps={steps} maxHeight={maxH} />
        </div>
      </SelectionProvider>
    )
  }

  return (
    <SelectionProvider className="full-bleed not-prose flex gap-6 px-4 sm:px-8">
      <div className="flex w-1/2 flex-col gap-2">
        {steps.map((step, i) => (
          <Selectable
            key={i}
            index={i}
            selectOn={['click']}
            className={clsx(
              'cursor-pointer rounded-md border px-5 py-2 transition-colors',
              'border-zinc-700 bg-zinc-900',
              'hover:bg-zinc-800',
              'data-[selected=true]:border-secondary-400',
            )}
          >
            <div className="prose dark:prose-invert">{step.prose}</div>
          </Selectable>
        ))}
      </div>
      <div className="w-1/2">
        <div className="sticky top-16">
          <V0CodePanel steps={steps} maxHeight={maxH} />
        </div>
      </div>
    </SelectionProvider>
  )
}

// ---------------------------------------------------------------------------
// CH namespace export
// ---------------------------------------------------------------------------

export const CH = {
  Code: CHCode,
  Scrollycoding: CHScrollycoding,
  Spotlight: CHSpotlight,
}
