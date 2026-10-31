import { useEffect, useRef, useState } from 'react'

interface SpeedControlProps {
  playbackSpeed: number
  isLoading: boolean
  onSpeedChange: (speed: number) => void
}

function formatSpeedValue(speed: number): string {
  return Number.parseFloat(speed.toFixed(3)).toString()
}

export function SpeedControl({ playbackSpeed, isLoading, onSpeedChange }: SpeedControlProps) {
  const [inputValue, setInputValue] = useState(() => formatSpeedValue(playbackSpeed))
  const isEditingRef = useRef(false)

  useEffect(() => {
    if (!isEditingRef.current) {
      setInputValue(formatSpeedValue(playbackSpeed))
    }
  }, [playbackSpeed])

  const commitValue = () => {
    const nextSpeed = Number.parseFloat(inputValue)

    isEditingRef.current = false

    if (Number.isFinite(nextSpeed)) {
      onSpeedChange(nextSpeed)
      return
    }

    setInputValue(formatSpeedValue(playbackSpeed))
  }

  return (
    <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span className="text-xs text-gray-500 dark:text-gray-400">Speed</span>
      <div className="flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-gray-600 dark:bg-gray-700">
        <input
          type="number"
          min={0.25}
          max={3}
          step={0.05}
          inputMode="decimal"
          value={inputValue}
          disabled={isLoading}
          data-testid="alphatab-speed-input"
          className="w-14 border-0 bg-transparent p-0 text-right text-xs text-gray-700 outline-hidden disabled:opacity-50 dark:text-gray-100"
          onFocus={() => {
            isEditingRef.current = true
          }}
          onChange={e => {
            isEditingRef.current = true
            setInputValue(e.target.value)
          }}
          onBlur={commitValue}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              commitValue()
            }

            if (e.key === 'Escape') {
              isEditingRef.current = false
              setInputValue(formatSpeedValue(playbackSpeed))
            }
          }}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">x</span>
      </div>
    </label>
  )
}