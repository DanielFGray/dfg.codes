import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { StickyPicker } from './StickyPicker'

type DimensionDef = Record<string, string[]>

type AdventureContextValue = {
  /** Current choices for each dimension, e.g. { server: "express", db: "postgres" } */
  choices: Record<string, string>
  /** Update a single dimension's choice */
  setChoice: (dimension: string, value: string) => void
  /** Dimension definitions: name → available options */
  dimensions: DimensionDef
}

const AdventureContext = createContext<AdventureContextValue | null>(null)

export function useAdventure() {
  const ctx = useContext(AdventureContext)
  if (!ctx) throw new Error('useAdventure must be used inside <Adventure>')
  return ctx
}

function readChoicesFromUrl(dimensions: DimensionDef): Record<string, string> {
  const params = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()
  const result: Record<string, string> = {}
  for (const [dim, options] of Object.entries(dimensions)) {
    const fromUrl = params.get(dim)
    result[dim] = fromUrl && options.includes(fromUrl) ? fromUrl : options[0]
  }
  return result
}

function writeChoicesToUrl(choices: Record<string, string>) {
  const url = new URL(window.location.href)
  for (const [dim, value] of Object.entries(choices)) {
    url.searchParams.set(dim, value)
  }
  window.history.replaceState(window.history.state, '', url.toString())
}

/**
 * Provides dimension state for a "choose your adventure" post.
 * Choices are stored in URL search params so they're linkable and survive refresh.
 * Uses replaceState instead of React Router navigation to avoid scroll reset.
 */
export function Adventure({
  dimensions,
  children,
}: {
  dimensions: DimensionDef
  children: ReactNode
}) {
  const [choices, setChoices] = useState(() => readChoicesFromUrl(dimensions))

  const setChoice = useCallback(
    (dimension: string, value: string) => {
      setChoices(prev => {
        const next = { ...prev, [dimension]: value }
        writeChoicesToUrl(next)
        return next
      })
    },
    [],
  )

  const value = useMemo(
    () => ({ choices, setChoice, dimensions }),
    [choices, setChoice, dimensions],
  )

  return (
    <AdventureContext.Provider value={value}>
      <StickyPicker />
      {children}
    </AdventureContext.Provider>
  )
}
