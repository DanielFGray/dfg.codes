interface VolumeControlProps {
  masterVolume: number
  isLoading: boolean
  onVolumeChange: (volume: number) => void
}

export function VolumeControl({ masterVolume, isLoading, onVolumeChange }: VolumeControlProps) {
  return (
    <div className="flex max-w-[200px] flex-1 items-center gap-2">
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 3.75a.75.75 0 00-1.264-.546L5.203 6H2.667a.75.75 0 00-.7.48A6.985 6.985 0 001.5 10c0 1.252.328 2.429.906 3.45a.75.75 0 00.761.55h2.036l3.533 2.796A.75.75 0 0010 16.25V3.75zM15.95 5.05a.75.75 0 00-1.06 1.061 5.5 5.5 0 010 7.778.75.75 0 001.06 1.06 7 7 0 000-9.899z" />
        <path d="M13.829 7.172a.75.75 0 00-1.061 1.06 2.5 2.5 0 010 3.536.75.75 0 001.06 1.06 4 4 0 000-5.656z" />
      </svg>
      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={masterVolume}
        onChange={e => onVolumeChange(parseFloat(e.target.value))}
        disabled={isLoading}
        className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-600"
      />
      <span className="w-8 text-xs text-gray-500 dark:text-gray-400">
        {Math.round(masterVolume * 100)}%
      </span>
    </div>
  )
}
