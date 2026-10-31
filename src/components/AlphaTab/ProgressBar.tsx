import { formatTime } from '../../lib/alphatab-utils'

interface ProgressBarProps {
  currentTimeMs: number
  endTimeMs: number
  isLoading: boolean
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function ProgressBar({
  currentTimeMs,
  endTimeMs,
  isLoading,
  onSeek,
}: ProgressBarProps) {
  const progressPercent = endTimeMs > 0 ? (currentTimeMs / endTimeMs) * 100 : 0

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="min-w-[72px] shrink-0 font-mono text-xs text-gray-600 md:min-w-[86px] dark:text-gray-300">
        {formatTime(currentTimeMs / 1000)} / {formatTime(endTimeMs / 1000)}
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-300 md:h-2 dark:bg-gray-600">
          <div
            className="h-full bg-secondary-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={endTimeMs || 100}
          value={currentTimeMs}
          onChange={onSeek}
          disabled={isLoading}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  )
}