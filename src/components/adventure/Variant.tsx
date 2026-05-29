import { useAdventure } from './context'
import type { ReactNode } from 'react'

type VariantProps = {
  children: ReactNode
  /** Catch-all: dimension name → value(s) that should show this content */
  [dimension: string]: ReactNode | string | string[]
}

/**
 * Conditionally renders children based on current adventure choices.
 * All specified dimensions must match for the content to show.
 *
 * Single value:
 *   <Variant server="express">Express uses middleware...</Variant>
 *
 * Multiple values (matches any):
 *   <Variant server={["express", "elysia"]}>Both use similar routing...</Variant>
 *
 * Multiple dimensions (all must match):
 *   <Variant server="express" adapter="kysely">Wire up Kysely with Express...</Variant>
 */
export function Variant(props: VariantProps) {
  const { children, ...dimensionProps } = props
  const { choices } = useAdventure()

  for (const [dim, value] of Object.entries(dimensionProps)) {
    const current = choices[dim]
    if (current === undefined) continue

    const allowed = Array.isArray(value) ? value : [value]
    if (!allowed.includes(current)) return null
  }

  return <>{children}</>
}
