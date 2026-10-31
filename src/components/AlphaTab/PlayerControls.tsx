import { HourglassIcon, LoadingSpinner, MetronomeIcon, PauseIcon, PlayIcon, StopIcon } from './icons'

interface PlayerControlsProps {
  metronomeVolume: number
  countInEnabled: boolean
  isLoading: boolean
  isPlaying: boolean
  onPlayPause: () => void
  onStop: () => void
  onMetronomeToggle: () => void
  onCountInToggle: () => void
}

export function PlayerControls({
  metronomeVolume,
  countInEnabled,
  isLoading,
  isPlaying,
  onPlayPause,
  onStop,
  onMetronomeToggle,
  onCountInToggle,
}: PlayerControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onPlayPause}
        disabled={isLoading}
        className="rounded-full bg-secondary-500 p-2 text-white transition-colors hover:bg-secondary-600 disabled:cursor-not-allowed disabled:bg-gray-400"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? <LoadingSpinner /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        onClick={onStop}
        disabled={isLoading}
        className="rounded-full bg-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        title="Stop"
      >
        <StopIcon />
      </button>

      <button
        type="button"
        onClick={onMetronomeToggle}
        disabled={isLoading}
        className={`rounded-full p-2 transition-colors ${
          metronomeVolume > 0
            ? 'bg-secondary-500 text-white'
            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
        } hover:bg-secondary-400 disabled:cursor-not-allowed disabled:opacity-50`}
        title={metronomeVolume > 0 ? 'Metronome On' : 'Metronome Off'}
      >
        <MetronomeIcon active={metronomeVolume > 0} />
      </button>

      <button
        type="button"
        onClick={onCountInToggle}
        disabled={isLoading}
        className={`rounded-full p-2 transition-colors ${
          countInEnabled
            ? 'bg-secondary-500 text-white'
            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
        } hover:bg-secondary-400 disabled:cursor-not-allowed disabled:opacity-50`}
        title={countInEnabled ? 'Count In On' : 'Count In Off'}
      >
        <HourglassIcon active={countInEnabled} />
      </button>
    </div>
  )
}
