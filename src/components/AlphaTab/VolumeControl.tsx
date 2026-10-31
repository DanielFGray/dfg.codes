import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { VolumeIcon } from './icons'

interface VolumeControlProps {
  volume: number
  disabled: boolean
  onVolumeChange: (volume: number) => void
}

export function VolumeControl({ volume, disabled, onVolumeChange }: VolumeControlProps) {
  const [open, setOpen] = useState(false)
  const [popupStyle, setPopupStyle] = useState<{ top: number; left: number } | null>(null)
  const popupId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const percentage = Math.round(volume * 100)

  const updatePopupPosition = useCallback(() => {
    if (typeof window === 'undefined' || !buttonRef.current || !popupRef.current) {
      return
    }

    const buttonRect = buttonRef.current.getBoundingClientRect()
    const popupRect = popupRef.current.getBoundingClientRect()
    const viewportPadding = 8
    const left = Math.min(
      Math.max(viewportPadding, buttonRect.right - popupRect.width),
      window.innerWidth - popupRect.width - viewportPadding,
    )
    const top = Math.min(
      buttonRect.bottom + viewportPadding,
      window.innerHeight - popupRect.height - viewportPadding,
    )

    setPopupStyle({ top, left })
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target) &&
        !popupRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)
    updatePopupPosition()

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePopupPosition)
      window.removeEventListener('scroll', updatePopupPosition, true)
    }
  }, [open, updatePopupPosition])

  useEffect(() => {
    if (disabled) {
      setOpen(false)
    }
  }, [disabled])

  useEffect(() => {
    if (!open) {
      setPopupStyle(null)
    }
  }, [open])

  const popup =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            id={popupId}
            ref={popupRef}
            role="dialog"
            aria-label="Track volume"
            className="fixed z-50 flex min-w-[4.5rem] flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            style={
              popupStyle
                ? { top: `${popupStyle.top}px`, left: `${popupStyle.left}px` }
                : { top: '-9999px', left: '-9999px' }
            }
          >
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Track</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={e => onVolumeChange(parseFloat(e.target.value))}
              data-testid="alphatab-track-volume-slider"
              className="m-0 h-28 w-5 cursor-pointer accent-secondary-500 [direction:rtl] [writing-mode:vertical-lr]"
            />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{percentage}%</span>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        disabled={disabled}
        aria-label={`Track volume ${percentage}%`}
        aria-controls={popupId}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid="alphatab-track-volume-button"
        className="flex items-center justify-center rounded-full bg-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        <VolumeIcon />
      </button>
      {popup}
    </div>
  )
}
