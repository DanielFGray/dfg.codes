import {
  Children,
  isValidElement,
  useMemo,
  type ReactNode,
} from 'react'
import type { HighlightedCode } from 'codehike/code'
import { Code } from '@/components/Code'
import { useAdventure } from './context'

type VariantCodeMap = Record<string, HighlightedCode>

/**
 * Extracts HighlightedCode objects from children, keyed by variant value.
 *
 * Expected children structure (after Code Hike MDX processing):
 *   <Variant value="express"><Code codeblock={...} /></Variant>
 *   <Variant value="elysia"><Code codeblock={...} /></Variant>
 */
function extractCodeblocks(children: ReactNode, dimension: string): VariantCodeMap {
  const map: VariantCodeMap = {}

  Children.forEach(children, child => {
    if (!isValidElement(child)) return

    const variantProps = child.props as Record<string, unknown>

    // Support both <Variant value="x"> and <Variant server="x">
    const variantValue =
      (variantProps.value as string) ?? (variantProps[dimension] as string)
    if (!variantValue) return

    const codeblock = findCodeblock(variantProps.children as ReactNode)
    if (codeblock) {
      map[variantValue] = codeblock
    }
  })

  return map
}

/** Recursively search children for a component with a `codeblock` prop */
function findCodeblock(node: ReactNode): HighlightedCode | null {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findCodeblock(child)
        if (found) return found
      }
    }
    return null
  }

  const props = node.props as Record<string, unknown>

  if (props.codeblock) {
    return props.codeblock as HighlightedCode
  }

  if (props.children) {
    return findCodeblock(props.children as ReactNode)
  }

  return null
}

/**
 * Renders a single animated code block that transitions between variants.
 * Delegates rendering to the shared Code component so styles stay consistent.
 *
 * Usage in MDX:
 *
 * <AdventureCode dimension="server">
 * <Variant value="express">
 *
 * ```ts src/index.ts
 * import express from 'express'
 * ```
 *
 * </Variant>
 * <Variant value="elysia">
 *
 * ```ts src/index.ts
 * import { Elysia } from 'elysia'
 * ```
 *
 * </Variant>
 * </AdventureCode>
 */
export function AdventureCode({
  dimension,
  children,
}: {
  dimension: string
  children: ReactNode
}) {
  const { choices } = useAdventure()

  const codeblocks = useMemo(
    () => extractCodeblocks(children, dimension),
    [children, dimension],
  )

  const currentValue = choices[dimension]
  const raw = codeblocks[currentValue]

  if (!raw) {
    const available = Object.keys(codeblocks).join(', ')
    console.warn(
      `<AdventureCode>: no codeblock for ${dimension}="${currentValue}". Available: ${available}`,
    )
    return null
  }

  return <Code codeblock={raw} />
}
