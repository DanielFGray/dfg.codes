import { useAdventure } from './context'

/**
 * Renders pill buttons for a single dimension.
 *
 * <Pick dimension="server" />
 * <Pick dimension="server" label="Choose your server:" />
 */
export function Pick({ dimension, label }: { dimension: string; label?: string }) {
  const { choices, setChoice, dimensions } = useAdventure()
  const options = dimensions[dimension]
  if (!options) {
    console.warn(`<Pick>: unknown dimension "${dimension}"`)
    return null
  }

  const current = choices[dimension]

  return (
    <div className="not-prose my-4 flex flex-wrap items-center gap-2">
      {label && <span className="text-sm font-medium text-primary-600 dark:text-primary-400">{label}</span>}
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => setChoice(dimension, opt)}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            current === opt
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-800 dark:text-primary-300 dark:hover:bg-primary-700'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
