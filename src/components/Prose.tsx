import { classed } from '@tw-classed/react'

export const Prose = classed('div', 'prose prose-xl dark:prose-invert')

export const Callout = classed(
  'blockquote',
  'dark:bg-primary-800/40 border-0 dark:text-primary-200 bg-primary-100/50 rounded-xl shadow-lg dark:shadow-black/40 shadow-primary-400/40 -mx-6 not-italic pr-8 py-1',
)
Callout.Title = function CalloutTitle({ children }) {
  return <h2 className="mt-4 text-lg font-semibold">{children}</h2>
}
