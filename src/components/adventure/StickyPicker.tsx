import { useAdventure } from './context'

/**
 * Compact sticky bar showing all dimension choices.
 * Sticks to the top of the viewport when scrolled past.
 */
export function StickyPicker() {
  const { choices, setChoice, dimensions } = useAdventure()

  return (
    <div className="not-prose sticky top-0 z-30 -mx-4 mb-4 border-b border-primary-200/60 bg-zinc-100/90 px-4 py-2 backdrop-blur-sm dark:border-primary-700/30 dark:bg-zinc-900/90">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {Object.entries(dimensions).map(([dim, options]) => (
          <div key={dim} className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-primary-500 dark:text-primary-400">
              {dim}
            </span>
            <div className="flex gap-1">
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => setChoice(dim, opt)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    choices[dim] === opt
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-primary-200/60 text-primary-600 hover:bg-primary-300/60 dark:bg-primary-800/60 dark:text-primary-300 dark:hover:bg-primary-700/60'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
