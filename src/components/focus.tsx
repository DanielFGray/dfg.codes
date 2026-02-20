import { AnnotationHandler, InnerLine, InnerPre, getPreRef } from 'codehike/code'
import { useLayoutEffect, useRef } from 'react'

/**
 * Focus handler for Code Hike v1
 * Dims unfocused lines and ensures focused lines are visible when scrolling
 *
 * Usage in MDX:
 * ```js focus=2
 * // or with comment annotation:
 * // !focus(1:3)
 * ```
 */

// Client component for scroll-to-focus behavior
function PreWithFocus({
  ...props
}: React.ComponentProps<typeof InnerPre> & { ref?: React.RefObject<HTMLPreElement> }) {
  const ref = getPreRef(props)
  useScrollToFocus(ref)
  return <InnerPre merge={props} />
}

function useScrollToFocus(ref: React.RefObject<HTMLPreElement | null>) {
  const firstRender = useRef(true)

  useLayoutEffect(() => {
    if (ref.current) {
      // Find all descendants with data-focus="true"
      const focusedElements = ref.current.querySelectorAll(
        '[data-focus=true]',
      ) as NodeListOf<HTMLElement>

      if (focusedElements.length === 0) return

      // Find top and bottom of the focused elements
      const containerRect = ref.current.getBoundingClientRect()
      let top = Infinity
      let bottom = -Infinity

      focusedElements.forEach(el => {
        const rect = el.getBoundingClientRect()
        top = Math.min(top, rect.top - containerRect.top)
        bottom = Math.max(bottom, rect.bottom - containerRect.top)
      })

      // Scroll to the focused elements if any part of them is not visible
      if (bottom > containerRect.height || top < 0) {
        ref.current.scrollTo({
          top: ref.current.scrollTop + top - 10,
          behavior: firstRender.current ? 'instant' : 'smooth',
        })
      }

      firstRender.current = false
    }
  })
}

export const focus: AnnotationHandler = {
  name: 'focus',
  onlyIfAnnotated: true,
  PreWithRef: PreWithFocus,
  Line: props => (
    <InnerLine
      merge={props}
      className="opacity-50 transition-opacity duration-300 data-[focus=true]:opacity-100"
    />
  ),
  AnnotatedLine: ({ ...props }) => <InnerLine merge={props} data-focus={true} />,
}
