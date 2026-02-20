interface SpeedControlProps {
  playbackSpeed: number
  isLoading: boolean
  onSpeedChange: (speed: number) => void
}

export function SpeedControl({ playbackSpeed, isLoading, onSpeedChange }: SpeedControlProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400">Speed:</span>
      <select
        value={playbackSpeed}
        onChange={e => onSpeedChange(parseFloat(e.target.value))}
        disabled={isLoading}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
      >
        <option value={0.25}>0.25x</option>
        <option value={0.5}>0.5x</option>
        <option value={0.75}>0.75x</option>
        <option value={1}>1x</option>
        <option value={1.25}>1.25x</option>
        <option value={1.5}>1.5x</option>
        <option value={2}>2x</option>
      </select>
    </div>
  )
}