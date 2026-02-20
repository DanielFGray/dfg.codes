import { formatTime } from '../../lib/alphatab-utils'

interface ProgressBarProps {
  currentSeconds: number
  endSeconds: number
  currentTick: number
  endTick: number
  isLoading: boolean
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function ProgressBar({
  currentSeconds,
  endSeconds,
  currentTick,
  endTick,
  isLoading,
  onSeek,
}: ProgressBarProps) {
  const progressPercent = endSeconds > 0 ? (currentSeconds / endSeconds) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      {/* Time display */}
      <div className="min-w-[80px] font-mono text-sm text-gray-600 dark:text-gray-300">
        {formatTime(currentSeconds)} / {formatTime(endSeconds)}
      </div>

      {/* Progress bar */}
      <div className="relative flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-gray-300 dark:bg-gray-600">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={endTick || 100}
          value={currentTick}
          onChange={onSeek}
          disabled={isLoading}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  )
}