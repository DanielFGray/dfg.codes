import { HighlightedCode, Pre } from 'codehike/code'
import { focus } from '@/components/focus'
import { mark } from '@/components/mark'
import { getCodeblockLabel, withMetaAnnotations } from '@/components/annotations'

const handlers = [focus, mark]

export function Code({ codeblock }: { codeblock: HighlightedCode }) {
  const label = getCodeblockLabel(codeblock)
  const code = withMetaAnnotations(codeblock)

  if (!label) {
    return <Pre code={code} handlers={handlers} className="my-4 overflow-auto rounded-lg p-4" />
  }

  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-primary-200 bg-[var(--ch-16)] shadow-md dark:border-primary-700/30">
      <div className="border-b border-primary-200 bg-[var(--ch-22)] px-4 py-1.5 font-mono text-xs text-primary-500 dark:border-primary-700/30 dark:text-primary-400">
        {label}
      </div>
      <Pre code={code} handlers={handlers} className="my-0 overflow-auto rounded-none p-4" />
    </div>
  )
}
