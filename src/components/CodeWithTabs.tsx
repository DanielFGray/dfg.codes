import { Block, CodeBlock, parseProps } from 'codehike/blocks'
import { Pre, highlight, type RawCode, type HighlightedCode } from 'codehike/code'
import { Tabs, TabList, Tab, TabPanel } from 'react-aria-components'
import { z } from 'zod/v4'
import { useState, useEffect, useMemo } from 'react'
import { focus } from './focus'
import { mark } from './mark'
import { bg } from './bg'

const Schema = Block.extend({ tabs: z.array(CodeBlock) })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CodeWithTabs(props: any) {
  const { tabs } = useMemo(() => parseProps(props, Schema) as { tabs: RawCode[] }, [props])
  return <CodeTabsClient tabs={tabs} />
}

function CodeTabsClient({ tabs }: { tabs: RawCode[] }) {
  const [highlighted, setHighlighted] = useState<HighlightedCode[] | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all(tabs.map(tab => highlight(tab, 'github-dark'))).then(result => {
      if (!cancelled) setHighlighted(result)
    })
    return () => { cancelled = true }
  }, [tabs])

  if (!highlighted) {
    return (
      <div
        style={{
          background: 'var(--editor-bg)',
          border: '1px solid var(--editor-border)',
          borderRadius: 8,
          padding: 16,
          minHeight: 80,
          color: 'var(--editor-text-muted)',
          fontSize: 13,
        }}
      >
        Loading...
      </div>
    )
  }

  const firstId = tabs[0]?.meta || '0'

  return (
    <Tabs defaultSelectedKey={firstId} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--editor-border)' }}>
      <TabList
        aria-label="Code files"
        style={{
          display: 'flex',
          background: 'var(--editor-bg-subtle)',
          borderBottom: '1px solid var(--editor-border)',
          overflow: 'auto',
        }}
      >
        {tabs.map(tab => (
          <Tab
            key={tab.meta}
            id={tab.meta}
            style={({ isSelected }) => ({
              padding: '6px 16px',
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif',
              background: isSelected ? 'var(--editor-bg)' : 'transparent',
              color: isSelected ? 'var(--editor-text)' : 'var(--editor-text-faint)',
              border: 'none',
              borderBottom: isSelected ? '2px solid var(--editor-accent)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              outline: 'none',
            })}
          >
            {tab.meta}
          </Tab>
        ))}
      </TabList>
      {tabs.map((tab, i) => (
        <TabPanel
          key={tab.meta}
          id={tab.meta}
          style={{ background: 'var(--editor-bg)', outline: 'none' }}
        >
          <Pre
            code={highlighted[i]}
            handlers={[focus, mark, bg]}
            className="overflow-auto p-4"
          />
        </TabPanel>
      ))}
    </Tabs>
  )
}
