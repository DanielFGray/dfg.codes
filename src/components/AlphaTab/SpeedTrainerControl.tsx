import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useState } from 'react'

export type SpeedTrainerStepMode = 'percent' | 'bpm'

interface SpeedTrainerControlProps {
  isLooping: boolean
  isLoading: boolean
  hasSelection: boolean
  loopLabel: string
  loopCount: number
  stepMode: SpeedTrainerStepMode
  stepValue: number
  currentSpeed: number
  currentTempoBpm: number | null
  onLoopToggle: () => void
  onLoopCountChange: (value: number) => void
  onStepModeChange: (mode: SpeedTrainerStepMode) => void
  onStepValueChange: (value: number) => void
  onClearSelection: () => void
}

function formatSpeedLabel(speed: number): string {
  return `${Number.parseFloat(speed.toFixed(2))}x`
}

export function SpeedTrainerControl({
  isLooping,
  isLoading,
  hasSelection,
  loopLabel,
  loopCount,
  stepMode,
  stepValue,
  currentSpeed,
  currentTempoBpm,
  onLoopToggle,
  onLoopCountChange,
  onStepModeChange,
  onStepValueChange,
  onClearSelection,
}: SpeedTrainerControlProps) {
  const [open, setOpen] = useState(false)

  const handleTrainerButtonClick = () => {
    if (isLooping) {
      onLoopToggle()
      return
    }

    onLoopToggle()
    setOpen(true)
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <button
          type="button"
          onClick={handleTrainerButtonClick}
          disabled={isLoading}
          aria-pressed={isLooping}
          data-testid="alphatab-trainer-open"
          className={`rounded border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isLooping
              ? 'border-secondary-500 bg-secondary-500 text-white hover:bg-secondary-600'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Speed Trainer
        </button>
      </div>

      <Dialog open={open} onClose={setOpen} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-4">
              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Speed Trainer
              </DialogTitle>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label="Close speed trainer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div data-testid="alphatab-trainer-modal" className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Drag directly across the score to loop any passage, including partial measures, or leave the
                selection empty to train the full piece.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Loop range
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{loopLabel}</div>
                  {hasSelection && (
                    <button
                      type="button"
                      onClick={onClearSelection}
                      disabled={isLoading}
                      data-testid="alphatab-loop-reset"
                      className="mt-2 text-xs text-secondary-600 underline underline-offset-2 transition-colors hover:text-secondary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-secondary-400 dark:hover:text-secondary-300"
                    >
                      Reset to whole piece
                    </button>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Current tempo
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currentTempoBpm === null
                      ? formatSpeedLabel(currentSpeed)
                      : `${Number.parseFloat(currentTempoBpm.toFixed(1))} BPM`}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Playback speed: {formatSpeedLabel(currentSpeed)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-900 dark:text-gray-100">Loop playback</span>
                <button
                  type="button"
                  onClick={onLoopToggle}
                  disabled={isLoading}
                  data-testid="alphatab-loop-toggle"
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isLooping
                      ? 'bg-secondary-500 text-white hover:bg-secondary-600'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {isLooping ? 'On' : 'Off'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Tempo progression</div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                  <span>After looping</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={loopCount}
                    onChange={e => onLoopCountChange(Number.parseFloat(e.target.value))}
                    disabled={isLoading}
                    data-testid="alphatab-trainer-loop-count"
                    className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <span>{loopCount === 1 ? 'time,' : 'times,'} increase tempo by</span>
                  <input
                    type="number"
                    min={0}
                    step={stepMode === 'bpm' ? 1 : 0.5}
                    value={stepValue}
                    onChange={e => onStepValueChange(Number.parseFloat(e.target.value))}
                    disabled={isLoading}
                    data-testid="alphatab-trainer-step-input"
                    className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <select
                    value={stepMode}
                    onChange={e => onStepModeChange(e.target.value === 'bpm' ? 'bpm' : 'percent')}
                    disabled={isLoading}
                    data-testid="alphatab-trainer-step-mode"
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="percent">%</option>
                    <option value="bpm">BPM</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-secondary-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-secondary-600"
                >
                  Done
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
