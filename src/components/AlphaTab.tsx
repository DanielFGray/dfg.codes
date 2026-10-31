import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlphaTabApi, ScrollMode, model, synth } from '@coderline/alphatab'

import { getColors, useColorScheme } from '../lib/alphatab-utils'
import { PlayerControls } from './AlphaTab/PlayerControls'
import { ProgressBar } from './AlphaTab/ProgressBar'
import { SpeedControl } from './AlphaTab/SpeedControl'
import { SpeedTrainerControl, type SpeedTrainerStepMode } from './AlphaTab/SpeedTrainerControl'
import { VolumeControl } from './AlphaTab/VolumeControl'

export interface AlphaTexNotationProps {
  tex: string
  defaultTrackIndex?: number | null
  onPlaybackSeconds?: (seconds: number) => void
  onDurationSeconds?: (seconds: number) => void
}

type PlayerState = 'loading' | 'ready' | 'playing' | 'paused'

interface PlayerPosition {
  currentTimeMs: number
  endTimeMs: number
  currentTick: number
  endTick: number
}

interface TrackOption {
  index: number
  label: string
}

type TrackVolumeMap = Record<number, number>

interface PlaybackTrack {
  index: number
  name?: string
  shortName?: string
  short_name?: string
  playbackInfo: {
    volume: number
    primaryChannel: number
    secondaryChannel: number
  }
}

interface ScrollableBarBounds {
  y: number
  h: number
}

interface ScrollableBeatBounds {
  barBounds: {
    masterBarBounds: {
      realBounds: ScrollableBarBounds
    }
  }
}

interface PlaybackTickRange {
  startTick: number
  endTick: number
}

interface LoopSelection {
  playbackRange: PlaybackTickRange
  startMeasure: number
  endMeasure: number
  startBeat: number
  endBeat: number
  startBeatCount: number
  endBeatCount: number
}

type LoopBeatSnapshot = Parameters<AlphaTabApi['highlightPlaybackRange']>[0]
type RenderedTrack = AlphaTabApi['tracks'][number]

interface NavigableBeat {
  beat: LoopBeatSnapshot
  startTick: number
  masterBarIndex: number
}

interface PositionSnapshot {
  currentTime: number
  endTime: number
  currentTick: number
  endTick: number
}

const MIN_ZOOM_FACTOR = 0.8
const MAX_ZOOM_FACTOR = 1.6
const ZOOM_STEP = 0.1
const MIN_DISPLAY_SCALE = 0.7
const MAX_DISPLAY_SCALE = 1.5
const MIN_PLAYBACK_SPEED = 0.25
const MAX_PLAYBACK_SPEED = 3
const DEFAULT_TRACK_VOLUME = 1
const DEFAULT_COUNT_IN_VOLUME = 1
const AUTO_SCROLL_TOP_MARGIN = 16
const AUTO_SCROLL_BOTTOM_MARGIN = 24

const EMPTY_POSITION: PlayerPosition = {
  currentTimeMs: 0,
  endTimeMs: 0,
  currentTick: 0,
  endTick: 0,
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

function normalizePlaybackSpeed(speed: number): number {
  return Math.round(clampValue(speed, MIN_PLAYBACK_SPEED, MAX_PLAYBACK_SPEED) * 1000) / 1000
}

function toPlayerPosition(position: PositionSnapshot): PlayerPosition {
  return {
    currentTimeMs: position.currentTime,
    endTimeMs: position.endTime,
    currentTick: position.currentTick,
    endTick: position.endTick,
  }
}

function toNormalizedTrackVolume(volume: number): number {
  return clampValue(volume / 16, 0, 1)
}

function toPlaybackTrackVolume(volume: number): number {
  return clampValue(volume, 0, 1) * 16
}

function getTrackChannels(track: PlaybackTrack): number[] {
  return [...new Set([track.playbackInfo.primaryChannel, track.playbackInfo.secondaryChannel])].filter(
    channel => Number.isInteger(channel) && channel >= 0,
  )
}

function resolveTrackVolume(track: PlaybackTrack, trackVolumes: TrackVolumeMap): number {
  return trackVolumes[track.index] ?? toNormalizedTrackVolume(track.playbackInfo.volume)
}

function applyTrackVolume(api: AlphaTabApi, track: PlaybackTrack, volume: number): void {
  const normalized = clampValue(volume, 0, 1)
  track.playbackInfo.volume = toPlaybackTrackVolume(normalized)

  const player = api.player
  if (!player) {
    return
  }

  for (const channel of getTrackChannels(track)) {
    player.setChannelVolume(channel, normalized)
  }
}

function hasSamePlaybackRange(
  left: PlaybackTickRange | null | undefined,
  right: PlaybackTickRange | null | undefined,
): boolean {
  return left?.startTick === right?.startTick && left?.endTick === right?.endTick
}

function formatTrackLabel(track: { index?: unknown; name?: unknown; shortName?: unknown; short_name?: unknown }): string {
  const index = typeof track.index === 'number' && Number.isFinite(track.index) ? track.index : 0
  const toText = (value: unknown): string | null => {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  const name = toText(track.name) ?? toText(track.shortName) ?? `Track ${index + 1}`
  const shortName = toText(track.short_name) ?? toText(track.shortName) ?? toText(track.name) ?? name

  return shortName !== name ? `${name} (${shortName})` : name
}

function formatLoopLabel(loopSelection: LoopSelection | null): string {
  if (!loopSelection) {
    return 'Full piece'
  }

  const isWholeStartMeasure = loopSelection.startBeat === 1
  const isWholeEndMeasure = loopSelection.endBeat === loopSelection.endBeatCount

  return loopSelection.startMeasure === loopSelection.endMeasure
    ? loopSelection.startBeat === 1 && loopSelection.endBeat === loopSelection.endBeatCount
      ? `Measure ${loopSelection.startMeasure}`
      : loopSelection.startBeat === loopSelection.endBeat
        ? `M${loopSelection.startMeasure} beat ${loopSelection.startBeat}`
        : `M${loopSelection.startMeasure} beats ${loopSelection.startBeat}-${loopSelection.endBeat}`
    : isWholeStartMeasure && isWholeEndMeasure
      ? `Measures ${loopSelection.startMeasure}-${loopSelection.endMeasure}`
      : `M${loopSelection.startMeasure} b${loopSelection.startBeat} - M${loopSelection.endMeasure} b${loopSelection.endBeat}`
}

function getLoopSelection(
  startBeat: LoopBeatSnapshot,
  endBeat: LoopBeatSnapshot,
  playbackRange: PlaybackTickRange,
): LoopSelection {
  return {
    playbackRange,
    startMeasure: startBeat.voice.bar.masterBar.index + 1,
    endMeasure: endBeat.voice.bar.masterBar.index + 1,
    startBeat: startBeat.index + 1,
    endBeat: endBeat.index + 1,
    startBeatCount: startBeat.voice.beats.length,
    endBeatCount: endBeat.voice.beats.length,
  }
}

function collectNavigableBeats(tracks: readonly RenderedTrack[]): NavigableBeat[] {
  const beatsByTick = new Map<number, NavigableBeat>()

  for (const track of tracks) {
    for (const stave of track.staves) {
      for (const bar of stave.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            if (beatsByTick.has(beat.absolutePlaybackStart)) {
              continue
            }

            beatsByTick.set(beat.absolutePlaybackStart, {
              beat: beat as LoopBeatSnapshot,
              startTick: beat.absolutePlaybackStart,
              masterBarIndex: beat.voice.bar.masterBar.index,
            })
          }
        }
      }
    }
  }

  return [...beatsByTick.values()].sort((left, right) => left.startTick - right.startTick)
}

function findCurrentNavigableBeatIndex(beats: readonly NavigableBeat[], currentTick: number): number {
  if (beats.length === 0) {
    return -1
  }

  let low = 0
  let high = beats.length - 1
  let result = 0

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const middleBeat = beats[middle]

    if (!middleBeat || middleBeat.startTick > currentTick) {
      high = middle - 1
      continue
    }

    result = middle
    low = middle + 1
  }

  return result
}

function getMeasureBoundaryBeat(
  beats: readonly NavigableBeat[],
  currentIndex: number,
  edge: 'start' | 'end',
): NavigableBeat | null {
  const currentBeat = beats[currentIndex]
  if (!currentBeat) {
    return null
  }

  let index = currentIndex
  if (edge === 'start') {
    while (index > 0 && beats[index - 1]?.masterBarIndex === currentBeat.masterBarIndex) {
      index -= 1
    }
  } else {
    while (index < beats.length - 1 && beats[index + 1]?.masterBarIndex === currentBeat.masterBarIndex) {
      index += 1
    }
  }

  return beats[index] ?? null
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox'], [role='slider']",
    ),
  )
}

function getNextTrainerPlaybackSpeed(
  currentSpeed: number,
  stepMode: SpeedTrainerStepMode,
  stepValue: number,
  baseTempoBpm: number | null,
): number {
  const normalizedStep = Math.max(0, stepValue)

  if (normalizedStep === 0) {
    return normalizePlaybackSpeed(currentSpeed)
  }

  if (stepMode === 'bpm') {
    if (!baseTempoBpm || baseTempoBpm <= 0) {
      return normalizePlaybackSpeed(currentSpeed)
    }

    return normalizePlaybackSpeed(currentSpeed + normalizedStep / baseTempoBpm)
  }

  return normalizePlaybackSpeed(currentSpeed * (1 + normalizedStep / 100))
}

function getResponsiveDisplayConfig(width: number, zoomFactor: number): { scale: number; stretchForce: number } {
  if (width <= 360) {
    return {
      scale: clampValue(0.78 * zoomFactor, MIN_DISPLAY_SCALE, MAX_DISPLAY_SCALE),
      stretchForce: 0.82,
    }
  }

  if (width <= 420) {
    return {
      scale: clampValue(0.84 * zoomFactor, MIN_DISPLAY_SCALE, MAX_DISPLAY_SCALE),
      stretchForce: 0.88,
    }
  }

  if (width <= 520) {
    return {
      scale: clampValue(0.9 * zoomFactor, MIN_DISPLAY_SCALE, MAX_DISPLAY_SCALE),
      stretchForce: 0.94,
    }
  }

  if (width < 768) {
    return {
      scale: clampValue(0.96 * zoomFactor, MIN_DISPLAY_SCALE, MAX_DISPLAY_SCALE),
      stretchForce: 0.97,
    }
  }

  return {
    scale: clampValue(zoomFactor, MIN_DISPLAY_SCALE, MAX_DISPLAY_SCALE),
    stretchForce: 1,
  }
}

export function AlphaTexNotation({
  tex,
  defaultTrackIndex,
  onPlaybackSeconds,
  onDurationSeconds,
}: AlphaTexNotationProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsPanelRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const initialTrackAppliedRef = useRef(false)
  const pendingPlaybackMsRef = useRef(0)
  const lastPlaybackStartedAtRef = useRef<number | null>(null)
  const containerWidthRef = useRef(0)
  const resizeFrameRef = useRef<number | null>(null)
  const lastAutoScrollTargetRef = useRef<number | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const positionSyncFrameRef = useRef<number | null>(null)
  const completedTrainerLoopsRef = useRef(0)
  const currentTickRef = useRef(0)
  const navigableBeatsRef = useRef<NavigableBeat[]>([])
  const keyboardSelectionAnchorRef = useRef<LoopBeatSnapshot | null>(null)
  const selectionHighlightRef = useRef<{ startBeat: LoopBeatSnapshot; endBeat: LoopBeatSnapshot } | null>(null)
  const isDark = useColorScheme()
  const instanceId = `alphatab${useId().replace(/:/g, '-')}`

  const [playerState, setPlayerState] = useState<PlayerState>('loading')
  const [position, setPosition] = useState<PlayerPosition>(EMPTY_POSITION)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [metronomeVolume, setMetronomeVolume] = useState(0)
  const [countInEnabled, setCountInEnabled] = useState(false)
  const [trackOptions, setTrackOptions] = useState<TrackOption[]>([])
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(null)
  const [trackVolumeByIndex, setTrackVolumeByIndex] = useState<TrackVolumeMap>({})
  const [zoomFactor, setZoomFactor] = useState(1)
  const [displayScale, setDisplayScale] = useState(1)
  const [baseTempoBpm, setBaseTempoBpm] = useState<number | null>(null)
  const [selectedLoopRange, setSelectedLoopRange] = useState<LoopSelection | null>(null)
  const [loopPlaybackEnabled, setLoopPlaybackEnabled] = useState(false)
  const [trainerLoopCount, setTrainerLoopCount] = useState(1)
  const [trainerStepMode, setTrainerStepMode] = useState<SpeedTrainerStepMode>('percent')
  const [trainerStepValue, setTrainerStepValue] = useState(5)
  const isLoading = playerState === 'loading'
  const isPlaying = playerState === 'playing'

  const onDurationSecondsRef = useLatestRef(onDurationSeconds)
  const selectedTrackIndexRef = useLatestRef(selectedTrackIndex)
  const trackVolumeByIndexRef = useLatestRef(trackVolumeByIndex)
  const playbackSpeedRef = useLatestRef(playbackSpeed)
  const baseTempoBpmRef = useLatestRef(baseTempoBpm)
  const loopPlaybackEnabledRef = useLatestRef(loopPlaybackEnabled)
  const trainerLoopCountRef = useLatestRef(trainerLoopCount)
  const trainerStepModeRef = useLatestRef(trainerStepMode)
  const trainerStepValueRef = useLatestRef(trainerStepValue)
  const zoomFactorRef = useLatestRef(zoomFactor)
  const countInEnabledRef = useLatestRef(countInEnabled)

  const applyPlaybackSpeed = useCallback((speed: number, api = apiRef.current) => {
    const nextSpeed = normalizePlaybackSpeed(speed)
    playbackSpeedRef.current = nextSpeed
    setPlaybackSpeed(nextSpeed)

    if (api) {
      api.playbackSpeed = nextSpeed
    }
  }, [])

  const resetTrainerLoopProgress = useCallback(() => {
    completedTrainerLoopsRef.current = 0
  }, [])

  const syncNavigableBeats = useCallback((api = apiRef.current) => {
    navigableBeatsRef.current = api ? collectNavigableBeats(api.tracks) : []
  }, [])

  const getVisibleTrackLookup = useCallback((api: AlphaTabApi) => {
    return new Set(api.tracks.map(track => track.index))
  }, [])

  const getCurrentPlaybackBeat = useCallback(
    (api: AlphaTabApi) => {
      const tickCache = api.tickCache
      if (!tickCache) {
        return null
      }

      return tickCache.findBeat(getVisibleTrackLookup(api), currentTickRef.current)
    },
    [getVisibleTrackLookup],
  )

  const getVisibleBeatInMasterBar = useCallback(
    (
      masterBarLookup: NonNullable<AlphaTabApi['tickCache']>['masterBars'][number],
      edge: 'start' | 'end',
      api: AlphaTabApi,
    ): NavigableBeat | null => {
      const visibleTracks = getVisibleTrackLookup(api)
      let beatLookup = edge === 'start' ? masterBarLookup.firstBeat : masterBarLookup.lastBeat

      while (beatLookup) {
        const beat = beatLookup.getVisibleBeatAtStart(visibleTracks)
        if (beat) {
          return {
            beat: beat as LoopBeatSnapshot,
            startTick: masterBarLookup.start + beatLookup.start,
            masterBarIndex: masterBarLookup.masterBar.index,
          }
        }

        beatLookup = edge === 'start' ? beatLookup.nextBeat : beatLookup.previousBeat
      }

      return null
    },
    [getVisibleTrackLookup],
  )

  const getMeasureJumpTarget = useCallback(
    (direction: -1 | 1) => {
      const api = apiRef.current
      const tickCache = api?.tickCache
      if (!api || !tickCache) {
        return null
      }

      const currentBeat = getCurrentPlaybackBeat(api)
      const currentMasterBar = currentBeat?.masterBar.masterBar
      const targetMasterBar = direction === 1 ? currentMasterBar?.nextMasterBar : currentMasterBar?.previousMasterBar

      if (!currentMasterBar || !targetMasterBar) {
        return null
      }

      const targetOccurrence =
        direction === 1
          ? (tickCache.masterBars.find(
              lookup => lookup.masterBar.index === targetMasterBar.index && lookup.start > currentTickRef.current,
            ) ?? null)
          : ([...tickCache.masterBars]
              .reverse()
              .find(
                lookup => lookup.masterBar.index === targetMasterBar.index && lookup.start < currentTickRef.current,
              ) ?? null)

      return targetOccurrence ? getVisibleBeatInMasterBar(targetOccurrence, 'start', api) : null
    },
    [getCurrentPlaybackBeat, getVisibleBeatInMasterBar],
  )

  const updatePosition = useCallback((nextPosition: PositionSnapshot) => {
    currentTickRef.current = nextPosition.currentTick
    setPosition(current => {
      const next = toPlayerPosition(nextPosition)
      return current.currentTimeMs === next.currentTimeMs &&
        current.endTimeMs === next.endTimeMs &&
        current.currentTick === next.currentTick &&
        current.endTick === next.endTick
        ? current
        : next
    })
  }, [])

  const syncPositionFromApi = useCallback(
    (api = apiRef.current) => {
      const currentPosition = api?.player?.currentPosition
      if (!currentPosition) {
        return
      }

      updatePosition(currentPosition)
    },
    [updatePosition],
  )

  const applySelectedTrackVolume = useCallback(() => {
    const api = apiRef.current
    const score = api?.score
    const trackIndex = selectedTrackIndexRef.current

    if (!api || !score || trackIndex === null) {
      return
    }

    const track = score.tracks.find(candidate => candidate.index === trackIndex)
    if (!track) {
      return
    }

    applyTrackVolume(api, track as PlaybackTrack, resolveTrackVolume(track as PlaybackTrack, trackVolumeByIndexRef.current))
  }, [selectedTrackIndexRef, trackVolumeByIndexRef])

  const scrollBeatIntoView = useCallback((beatBounds: ScrollableBeatBounds, behavior: ScrollBehavior) => {
    const container = containerRef.current
    if (!container || typeof window === 'undefined') {
      return
    }

    const scrollElement = document.scrollingElement
    if (!scrollElement) {
      return
    }

    const controlsPanelHeight = controlsPanelRef.current?.getBoundingClientRect().height ?? 0
    const safeTop = controlsPanelHeight + AUTO_SCROLL_TOP_MARGIN
    const safeBottom = window.innerHeight - AUTO_SCROLL_BOTTOM_MARGIN

    const barBounds = beatBounds.barBounds.masterBarBounds.realBounds
    const containerTop = container.getBoundingClientRect().top + window.scrollY
    const barTop = containerTop + barBounds.y
    const barBottom = barTop + barBounds.h
    const viewportTop = window.scrollY + safeTop
    const viewportBottom = window.scrollY + safeBottom

    if (barTop >= viewportTop && barBottom <= viewportBottom) {
      return
    }

    const maxScroll = Math.max(0, scrollElement.scrollHeight - window.innerHeight)
    const nextTarget = clampValue(barTop - safeTop, 0, maxScroll)

    if (
      lastAutoScrollTargetRef.current !== null &&
      Math.abs(lastAutoScrollTargetRef.current - nextTarget) < 4 &&
      Math.abs(window.scrollY - nextTarget) < 4
    ) {
      return
    }

    lastAutoScrollTargetRef.current = nextTarget
    window.scrollTo({ top: nextTarget, behavior })
  }, [])

  const scheduleBeatScroll = useCallback(
    (beatBounds: ScrollableBeatBounds, behavior: ScrollBehavior) => {
      if (typeof window === 'undefined') {
        return
      }

      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current)
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(() => {
        autoScrollFrameRef.current = null
        scrollBeatIntoView(beatBounds, behavior)
      })
    },
    [scrollBeatIntoView],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const initialWidth = Math.round(
      wrapperRef.current?.getBoundingClientRect().width ?? container.getBoundingClientRect().width,
    )
    containerWidthRef.current = initialWidth

    const initialDisplay = getResponsiveDisplayConfig(initialWidth || 1024, zoomFactorRef.current)

    pendingPlaybackMsRef.current = 0
    lastPlaybackStartedAtRef.current = null
    setPlayerState('loading')
    setPosition(EMPTY_POSITION)
    setTrackOptions([])
    setSelectedTrackIndex(null)
    setTrackVolumeByIndex({})
    setDisplayScale(initialDisplay.scale)
    setBaseTempoBpm(null)
    setSelectedLoopRange(null)
    initialTrackAppliedRef.current = false
    currentTickRef.current = 0
    navigableBeatsRef.current = []
    keyboardSelectionAnchorRef.current = null
    resetTrainerLoopProgress()
    selectionHighlightRef.current = null
    onDurationSecondsRef.current?.(0)

    container.innerText = tex

    const colors = getColors(isDark)

    const api = new AlphaTabApi(container, {
      core: {
        tex: true,
        engine: 'svg',
        logLevel: 1,
        fontDirectory: '/font/',
      },
      display: {
        scale: initialDisplay.scale,
        staveProfile: 'Default',
        stretchForce: initialDisplay.stretchForce,
        resources: {
          mainGlyphColor: colors.mainColor,
          secondaryGlyphColor: colors.secondaryColor,
          scoreInfoColor: colors.mainColor,
          staffLineColor: colors.staffLineColor,
          barSeparatorColor: colors.barSeparatorColor,
        },
      },
      player: {
        enablePlayer: true,
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        enableUserInteraction: true,
        soundFont: '/soundfont/sonivox.sf2',
        scrollMode: ScrollMode.Continuous,
      },
    })

    applyPlaybackSpeed(playbackSpeedRef.current, api)
    api.metronomeVolume = metronomeVolume
    api.countInVolume = countInEnabledRef.current ? DEFAULT_COUNT_IN_VOLUME : 0
    api.masterVolume = 1
    api.isLooping = loopPlaybackEnabledRef.current

    api.playerReady.on(() => {
      setPlayerState('ready')
      applySelectedTrackVolume()
    })

    api.customScrollHandler = {
      [Symbol.dispose]() {
        if (typeof window !== 'undefined' && autoScrollFrameRef.current !== null) {
          window.cancelAnimationFrame(autoScrollFrameRef.current)
          autoScrollFrameRef.current = null
        }
      },
      forceScrollTo(currentBeatBounds) {
        scheduleBeatScroll(currentBeatBounds, 'auto')
      },
      onBeatCursorUpdating(startBeat) {
        scheduleBeatScroll(startBeat, 'smooth')
      },
    }

    api.resize.on(args => {
      if (!args.settings) {
        return
      }

      containerWidthRef.current = args.newWidth
      const nextDisplay = getResponsiveDisplayConfig(args.newWidth, zoomFactorRef.current)
      args.settings.display.scale = nextDisplay.scale
      args.settings.display.stretchForce = nextDisplay.stretchForce
      setDisplayScale(current => (current === nextDisplay.scale ? current : nextDisplay.scale))
    })

    api.scoreLoaded.on(score => {
      setBaseTempoBpm(score.tempo > 0 ? score.tempo : null)
      setSelectedLoopRange(null)
      keyboardSelectionAnchorRef.current = null
      selectionHighlightRef.current = null

      setTrackVolumeByIndex(current => {
        const next: TrackVolumeMap = {}

        for (const track of score.tracks) {
          next[track.index] = resolveTrackVolume(track as PlaybackTrack, current)
          track.playbackInfo.volume = toPlaybackTrackVolume(next[track.index]!)
        }

        return next
      })

      setTrackOptions(
        score.tracks.map(track => ({
          index: track.index,
          label: formatTrackLabel(track),
        })),
      )

      const renderedTrackIndex = api.tracks[0]?.index
      const preferredTrack =
        defaultTrackIndex === null || defaultTrackIndex === undefined
          ? null
          : (score.tracks.find(track => track.index === defaultTrackIndex) ?? null)

      if (preferredTrack && renderedTrackIndex !== preferredTrack.index && !initialTrackAppliedRef.current) {
        preferredTrack.playbackInfo.volume = toPlaybackTrackVolume(
          resolveTrackVolume(preferredTrack as PlaybackTrack, trackVolumeByIndexRef.current),
        )
        initialTrackAppliedRef.current = true
        setSelectedTrackIndex(preferredTrack.index)
        setPosition(EMPTY_POSITION)
        onDurationSecondsRef.current?.(0)
        api.renderTracks([preferredTrack])
        return
      }

      setSelectedTrackIndex(currentTrackIndex => {
        if (typeof renderedTrackIndex === 'number') {
          return renderedTrackIndex
        }

        if (
          currentTrackIndex !== null &&
          score.tracks.some(track => track.index === currentTrackIndex)
        ) {
          return currentTrackIndex
        }

        return score.tracks[0]?.index ?? null
      })
      initialTrackAppliedRef.current = true
    })

    api.midiLoaded.on(e => {
      updatePosition(e)
      onDurationSecondsRef.current?.(e.endTime / 1000)
    })

    api.playbackRangeHighlightChanged.on(e => {
      if (e.startBeat && e.endBeat) {
        selectionHighlightRef.current = {
          startBeat: e.startBeat as LoopBeatSnapshot,
          endBeat: e.endBeat as LoopBeatSnapshot,
        }
        return
      }

      selectionHighlightRef.current = null
    })

    api.playbackRangeChanged.on(e => {
      if (!e.playbackRange) {
        resetTrainerLoopProgress()
        keyboardSelectionAnchorRef.current = null
        selectionHighlightRef.current = null
        setSelectedLoopRange(null)
        return
      }

      if (!selectionHighlightRef.current) {
        return
      }

      resetTrainerLoopProgress()
      const nextSelection = getLoopSelection(
        selectionHighlightRef.current.startBeat,
        selectionHighlightRef.current.endBeat,
        e.playbackRange,
      )
      setSelectedLoopRange(current =>
        current &&
        current.startMeasure === nextSelection.startMeasure &&
        current.endMeasure === nextSelection.endMeasure &&
        current.startBeat === nextSelection.startBeat &&
        current.endBeat === nextSelection.endBeat &&
        current.startBeatCount === nextSelection.startBeatCount &&
        current.endBeatCount === nextSelection.endBeatCount &&
        hasSamePlaybackRange(current.playbackRange, nextSelection.playbackRange)
          ? current
          : nextSelection,
      )
    })

    api.playerFinished.on(() => {
      if (!loopPlaybackEnabledRef.current) {
        return
      }

      completedTrainerLoopsRef.current += 1
      if (completedTrainerLoopsRef.current < Math.max(1, trainerLoopCountRef.current)) {
        return
      }

      completedTrainerLoopsRef.current = 0

      const nextSpeed = getNextTrainerPlaybackSpeed(
        playbackSpeedRef.current,
        trainerStepModeRef.current,
        trainerStepValueRef.current,
        baseTempoBpmRef.current,
      )

      if (nextSpeed === playbackSpeedRef.current) {
        return
      }

      applyPlaybackSpeed(nextSpeed, api)
    })

    api.playerStateChanged.on(e => {
      if (e.state === synth.PlayerState.Playing) {
        setPlayerState('playing')
      } else {
        setPlayerState(prev => (prev === 'loading' ? 'loading' : 'ready'))
      }
    })

    api.playerPositionChanged.on(e => {
      updatePosition(e)

      if (api.playerState === synth.PlayerState.Playing) {
        api.scrollToCursor()
      }
    })

    api.renderFinished.on(() => {
      syncNavigableBeats(api)
      currentTickRef.current = api.tickPosition
    })

    api.error.on(error => {
      console.error(`[AlphaTab] Error in instance ${instanceId}:`, error)
    })

    apiRef.current = api

    return () => {
      if (typeof window !== 'undefined' && autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current)
        autoScrollFrameRef.current = null
      }
      if (typeof window !== 'undefined' && positionSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(positionSyncFrameRef.current)
        positionSyncFrameRef.current = null
      }
      apiRef.current = null
      api.destroy()
    }
  }, [
    applyPlaybackSpeed,
    applySelectedTrackVolume,
    defaultTrackIndex,
    instanceId,
    isDark,
    metronomeVolume,
    resetTrainerLoopProgress,
    scheduleBeatScroll,
    syncNavigableBeats,
    tex,
    updatePosition,
    trackVolumeByIndexRef,
    trainerLoopCountRef,
    trainerStepModeRef,
    trainerStepValueRef,
    loopPlaybackEnabledRef,
    playbackSpeedRef,
    baseTempoBpmRef,
    countInEnabledRef,
    zoomFactorRef,
    onDurationSecondsRef,
  ])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      const nextWidth = Math.round(entry.contentRect.width)
      if (!nextWidth || nextWidth === containerWidthRef.current) {
        return
      }

      containerWidthRef.current = nextWidth
      const api = apiRef.current

      if (!api) {
        const nextDisplay = getResponsiveDisplayConfig(nextWidth, zoomFactorRef.current)
        setDisplayScale(current => (current === nextDisplay.scale ? current : nextDisplay.scale))
        return
      }

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null
        api.renderer.resizeRender()
      })
    })

    observer.observe(wrapper)

    return () => {
      observer.disconnect()
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
    }
  }, [zoomFactorRef])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (positionSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(positionSyncFrameRef.current)
      positionSyncFrameRef.current = null
    }

    if (!isPlaying) {
      syncPositionFromApi()
      return
    }

    const sync = () => {
      syncPositionFromApi()
      positionSyncFrameRef.current = window.requestAnimationFrame(sync)
    }

    sync()

    return () => {
      if (positionSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(positionSyncFrameRef.current)
        positionSyncFrameRef.current = null
      }
    }
  }, [isPlaying, syncPositionFromApi])

  useEffect(() => {
    const api = apiRef.current
    if (!api) {
      return
    }

    const colors = getColors(isDark)
    const resources = api.settings.display.resources

    resources.mainGlyphColor = model.Color.fromJson(colors.mainColor)!
    resources.secondaryGlyphColor = model.Color.fromJson(colors.secondaryColor)!
    resources.scoreInfoColor = model.Color.fromJson(colors.mainColor)!
    resources.staffLineColor = model.Color.fromJson(colors.staffLineColor)!
    resources.barSeparatorColor = model.Color.fromJson(colors.barSeparatorColor)!

    api.updateSettings()
    api.render()
  }, [isDark])

  useEffect(() => {
    const api = apiRef.current
    if (!api) {
      return
    }

    const width = containerWidthRef.current || Math.round(wrapperRef.current?.getBoundingClientRect().width ?? 0)
    const nextDisplay = getResponsiveDisplayConfig(width || 1024, zoomFactor)

    if (
      api.settings.display.scale === nextDisplay.scale &&
      api.settings.display.stretchForce === nextDisplay.stretchForce
    ) {
      setDisplayScale(current => (current === nextDisplay.scale ? current : nextDisplay.scale))
      return
    }

    api.settings.display.scale = nextDisplay.scale
    api.settings.display.stretchForce = nextDisplay.stretchForce
    setDisplayScale(nextDisplay.scale)
    api.updateSettings()
    api.render()
  }, [zoomFactor])

  const handlePlayPause = useCallback(() => {
    apiRef.current?.playPause()
  }, [])

  const moveCursorToBeat = useCallback(
    (targetBeat: NavigableBeat, extendSelection: boolean) => {
      const api = apiRef.current
      if (!api) {
        return
      }

      const currentBeat = getCurrentPlaybackBeat(api)

      if (extendSelection) {
        const anchorBeat =
          keyboardSelectionAnchorRef.current ?? (currentBeat?.beat as LoopBeatSnapshot | undefined) ?? targetBeat.beat

        keyboardSelectionAnchorRef.current = anchorBeat
        api.highlightPlaybackRange(anchorBeat, targetBeat.beat)
        api.applyPlaybackRangeFromHighlight()
        currentTickRef.current = targetBeat.startTick
        api.tickPosition = targetBeat.startTick
        syncPositionFromApi(api)
        api.scrollToCursor()
        return
      }

      keyboardSelectionAnchorRef.current = null
      resetTrainerLoopProgress()
      selectionHighlightRef.current = null
      setSelectedLoopRange(null)
      api.playbackRange = null
      api.clearPlaybackRangeHighlight()
      currentTickRef.current = targetBeat.startTick
      api.tickPosition = targetBeat.startTick
      syncPositionFromApi(api)
      api.scrollToCursor()
    },
    [getCurrentPlaybackBeat, resetTrainerLoopProgress, syncPositionFromApi],
  )

  const handlePlayFromStart = useCallback(() => {
    const api = apiRef.current
    if (!api) {
      return
    }

    const firstBeat = navigableBeatsRef.current[0]
    keyboardSelectionAnchorRef.current = null
    resetTrainerLoopProgress()
    selectionHighlightRef.current = null
    setSelectedLoopRange(null)
    api.playbackRange = null
    api.clearPlaybackRangeHighlight()
    api.stop()

    if (firstBeat) {
      currentTickRef.current = firstBeat.startTick
      api.tickPosition = firstBeat.startTick
    } else {
      currentTickRef.current = 0
      api.timePosition = 0
    }

    syncPositionFromApi(api)
    api.scrollToCursor()
    api.play()
  }, [resetTrainerLoopProgress, syncPositionFromApi])

  const handleStop = useCallback(() => {
    keyboardSelectionAnchorRef.current = null
    resetTrainerLoopProgress()
    apiRef.current?.stop()
  }, [resetTrainerLoopProgress])

  const handleSpeedChange = useCallback(
    (speed: number) => {
      resetTrainerLoopProgress()
      applyPlaybackSpeed(speed)
    },
    [applyPlaybackSpeed, resetTrainerLoopProgress],
  )

  const handleMetronomeToggle = useCallback(() => {
    const newVolume = metronomeVolume > 0 ? 0 : 1
    setMetronomeVolume(newVolume)
    if (apiRef.current) {
      apiRef.current.metronomeVolume = newVolume
    }
  }, [metronomeVolume])

  const handleCountInToggle = useCallback(() => {
    setCountInEnabled(current => {
      const nextEnabled = !current
      if (apiRef.current) {
        apiRef.current.countInVolume = nextEnabled ? DEFAULT_COUNT_IN_VOLUME : 0
      }
      return nextEnabled
    })
  }, [])

  const handleVolumeChange = useCallback((volume: number) => {
    const trackIndex = selectedTrackIndexRef.current
    if (trackIndex === null) {
      return
    }

    setTrackVolumeByIndex(current => ({
      ...current,
      [trackIndex]: volume,
    }))

    const api = apiRef.current
    const score = api?.score
    const track = score?.tracks.find(candidate => candidate.index === trackIndex)
    if (!api || !track) {
      return
    }

    applyTrackVolume(api, track as PlaybackTrack, volume)
  }, [selectedTrackIndexRef])

  const handleZoomOut = useCallback(() => {
    setZoomFactor(current =>
      clampValue(Math.round((current - ZOOM_STEP) * 10) / 10, MIN_ZOOM_FACTOR, MAX_ZOOM_FACTOR),
    )
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoomFactor(current =>
      clampValue(Math.round((current + ZOOM_STEP) * 10) / 10, MIN_ZOOM_FACTOR, MAX_ZOOM_FACTOR),
    )
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoomFactor(1)
  }, [])

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const timePosition = Number.parseFloat(e.target.value)
      if (apiRef.current) {
        apiRef.current.timePosition = timePosition
        syncPositionFromApi(apiRef.current)
      }
    },
    [syncPositionFromApi],
  )

  const flushPlayback = useCallback(() => {
    if (!onPlaybackSeconds) {
      return
    }

    const wholeSeconds = Math.floor(pendingPlaybackMsRef.current / 1000)
    if (wholeSeconds <= 0) {
      return
    }

    pendingPlaybackMsRef.current -= wholeSeconds * 1000
    onPlaybackSeconds(wholeSeconds)
  }, [onPlaybackSeconds])

  const accumulateElapsedPlayback = useCallback(() => {
    if (lastPlaybackStartedAtRef.current === null) {
      return
    }

    pendingPlaybackMsRef.current += Date.now() - lastPlaybackStartedAtRef.current
    lastPlaybackStartedAtRef.current = Date.now()
  }, [])

  const handleTrackChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const trackIndex = parseInt(e.target.value, 10)
      const api = apiRef.current
      const score = api?.score

      if (!api || !score || Number.isNaN(trackIndex)) {
        return
      }

      const track = score.tracks.find(candidate => candidate.index === trackIndex)
      if (!track) {
        return
      }

      track.playbackInfo.volume = toPlaybackTrackVolume(
        resolveTrackVolume(track as PlaybackTrack, trackVolumeByIndexRef.current),
      )
      resetTrainerLoopProgress()
      keyboardSelectionAnchorRef.current = null
      selectionHighlightRef.current = null
      setSelectedLoopRange(null)
      api.clearPlaybackRangeHighlight()
      api.playbackRange = null
      accumulateElapsedPlayback()
      lastPlaybackStartedAtRef.current = null
      flushPlayback()
      api.stop()
      setSelectedTrackIndex(trackIndex)
      setPosition(EMPTY_POSITION)
      onDurationSecondsRef.current?.(0)
      api.renderTracks([track])
    },
    [accumulateElapsedPlayback, flushPlayback, resetTrainerLoopProgress, trackVolumeByIndexRef, onDurationSecondsRef],
  )

  const handleLoopPlaybackToggle = useCallback(() => {
    resetTrainerLoopProgress()
    setLoopPlaybackEnabled(current => {
      const next = !current
      loopPlaybackEnabledRef.current = next

      if (apiRef.current) {
        apiRef.current.isLooping = next
      }

      return next
    })
  }, [resetTrainerLoopProgress, loopPlaybackEnabledRef])

  const handleTrainerLoopCountChange = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) {
        return
      }

      resetTrainerLoopProgress()
      setTrainerLoopCount(Math.max(1, Math.round(value)))
    },
    [resetTrainerLoopProgress],
  )

  const handleTrainerStepModeChange = useCallback(
    (stepMode: SpeedTrainerStepMode) => {
      resetTrainerLoopProgress()
      setTrainerStepMode(stepMode)
    },
    [resetTrainerLoopProgress],
  )

  const handleTrainerStepValueChange = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) {
        return
      }

      resetTrainerLoopProgress()
      setTrainerStepValue(Math.max(0, Math.round(value * 10) / 10))
    },
    [resetTrainerLoopProgress],
  )

  const handleClearLoopSelection = useCallback(() => {
    resetTrainerLoopProgress()
    keyboardSelectionAnchorRef.current = null
    selectionHighlightRef.current = null
    setSelectedLoopRange(null)

    const api = apiRef.current
    if (!api) {
      return
    }

    api.playbackRange = null
    api.clearPlaybackRangeHighlight()
    syncPositionFromApi(api)
  }, [resetTrainerLoopProgress, syncPositionFromApi])

  const handleKeyboardShortcut = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented || isLoading || isEditableShortcutTarget(event.target)) {
        return
      }

      if (event.code === 'Space' && !event.altKey && !event.metaKey) {
        event.preventDefault()
        if (event.repeat) {
          return
        }

        if (event.ctrlKey) {
          handlePlayFromStart()
          return
        }

        handlePlayPause()
        return
      }

      if (event.altKey || event.metaKey) {
        return
      }

      if (event.ctrlKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const targetBeat = getMeasureJumpTarget(event.key === 'ArrowRight' ? 1 : -1)
        if (!targetBeat) {
          return
        }

        event.preventDefault()
        moveCursorToBeat(targetBeat, event.shiftKey)
        return
      }

      const beats = navigableBeatsRef.current
      const currentIndex = findCurrentNavigableBeatIndex(beats, currentTickRef.current)
      if (currentIndex === -1) {
        return
      }

      let targetBeat: NavigableBeat | null = null

      switch (event.key) {
        case 'ArrowLeft':
          targetBeat = beats[Math.max(0, currentIndex - 1)] ?? null
          break
        case 'ArrowRight':
          targetBeat = beats[Math.min(beats.length - 1, currentIndex + 1)] ?? null
          break
        case 'Home':
          targetBeat = event.ctrlKey ? (beats[0] ?? null) : getMeasureBoundaryBeat(beats, currentIndex, 'start')
          break
        case 'End':
          targetBeat =
            event.ctrlKey ? (beats[beats.length - 1] ?? null) : getMeasureBoundaryBeat(beats, currentIndex, 'end')
          break
        default:
          return
      }

      if (!targetBeat) {
        return
      }

      event.preventDefault()
      moveCursorToBeat(targetBeat, event.shiftKey)
    },
    [getMeasureJumpTarget, handlePlayFromStart, handlePlayPause, isLoading, moveCursorToBeat],
  )

  useEffect(() => {
    if (!isPlaying || !onPlaybackSeconds) {
      accumulateElapsedPlayback()
      lastPlaybackStartedAtRef.current = null
      flushPlayback()
      return
    }

    lastPlaybackStartedAtRef.current = Date.now()

    const interval = window.setInterval(() => {
      accumulateElapsedPlayback()
      if (pendingPlaybackMsRef.current >= 5000) {
        flushPlayback()
      }
    }, 1000)

    return () => {
      window.clearInterval(interval)
      accumulateElapsedPlayback()
      lastPlaybackStartedAtRef.current = null
      flushPlayback()
    }
  }, [accumulateElapsedPlayback, flushPlayback, isPlaying, onPlaybackSeconds])

  useEffect(() => {
    applySelectedTrackVolume()
  }, [applySelectedTrackVolume, selectedTrackIndex, trackVolumeByIndex])

  useEffect(() => {
    const api = apiRef.current
    if (!api) {
      return
    }

    api.countInVolume = countInEnabled ? DEFAULT_COUNT_IN_VOLUME : 0
  }, [countInEnabled])

  const selectedTrackVolume =
    selectedTrackIndex === null ? DEFAULT_TRACK_VOLUME : (trackVolumeByIndex[selectedTrackIndex] ?? DEFAULT_TRACK_VOLUME)
  const currentTempoBpm =
    baseTempoBpm === null ? null : Number.parseFloat((baseTempoBpm * playbackSpeed).toFixed(1))

  return (
    <div ref={wrapperRef} className="mb-8" onKeyDownCapture={handleKeyboardShortcut}>
      <div
        ref={controlsPanelRef}
        className="sticky top-2 z-30 rounded-xl bg-primary-50/95 p-3 shadow-sm backdrop-blur dark:bg-primary-900/90"
      >
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:gap-3">
            <PlayerControls
              metronomeVolume={metronomeVolume}
              countInEnabled={countInEnabled}
              isLoading={isLoading}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onMetronomeToggle={handleMetronomeToggle}
              onCountInToggle={handleCountInToggle}
            />

            <ProgressBar
              currentTimeMs={position.currentTimeMs}
              endTimeMs={position.endTimeMs}
              isLoading={isLoading}
              onSeek={handleSeek}
            />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            {trackOptions.length > 1 && (
              <label className="flex min-w-0 shrink-0 items-center gap-1.5 whitespace-nowrap">
                <span className="text-xs text-gray-500 dark:text-gray-400">Track</span>
                <select
                  value={selectedTrackIndex ?? ''}
                  onChange={handleTrackChange}
                  disabled={isLoading}
                  data-testid="alphatab-track-select"
                  className="min-w-[9rem] rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                >
                  {trackOptions.map(track => (
                    <option key={track.index} value={track.index}>
                      {track.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              <span className="text-xs text-gray-500 dark:text-gray-400">Zoom</span>
              <div className="inline-flex overflow-hidden rounded border border-gray-300 dark:border-gray-600">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={isLoading || zoomFactor <= MIN_ZOOM_FACTOR}
                  aria-label="Zoom out notation"
                  data-testid="alphatab-zoom-out"
                  className="bg-white px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  disabled={isLoading || zoomFactor === 1}
                  aria-label="Reset notation zoom"
                  data-testid="alphatab-zoom-reset"
                  className="border-x border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Fit
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={isLoading || zoomFactor >= MAX_ZOOM_FACTOR}
                  aria-label="Zoom in notation"
                  data-testid="alphatab-zoom-in"
                  className="bg-white px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  +
                </button>
              </div>
              <span className="w-10 text-right text-xs text-gray-500 dark:text-gray-400">
                {Math.round(displayScale * 100)}%
              </span>
            </div>

            <SpeedControl playbackSpeed={playbackSpeed} isLoading={isLoading} onSpeedChange={handleSpeedChange} />

            <SpeedTrainerControl
              isLooping={loopPlaybackEnabled}
              isLoading={isLoading}
              hasSelection={selectedLoopRange !== null}
              loopLabel={formatLoopLabel(selectedLoopRange)}
              loopCount={trainerLoopCount}
              stepMode={trainerStepMode}
              stepValue={trainerStepValue}
              currentSpeed={playbackSpeed}
              currentTempoBpm={currentTempoBpm}
              onLoopToggle={handleLoopPlaybackToggle}
              onLoopCountChange={handleTrainerLoopCountChange}
              onStepModeChange={handleTrainerStepModeChange}
              onStepValueChange={handleTrainerStepValueChange}
              onClearSelection={handleClearLoopSelection}
            />

            <VolumeControl
              volume={selectedTrackVolume}
              disabled={isLoading || selectedTrackIndex === null}
              onVolumeChange={handleVolumeChange}
            />

            {isLoading && (
              <div className="text-xs text-gray-500 dark:text-gray-400">Loading soundfont...</div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-0 overflow-hidden bg-inherit">
        <div
          ref={containerRef}
          className="alphatab-container alphatab-player-surface relative z-0 min-h-[200px] w-full overscroll-x-contain rounded-lg focus-visible:ring-2 focus-visible:ring-secondary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none [&_.at-cursor-bar]:bg-secondary-500/15 [&_.at-cursor-beat]:w-0.75 [&_.at-cursor-beat]:bg-gray-400/75"
          id={instanceId}
          tabIndex={0}
          aria-label="Interactive notation player"
          onPointerDown={event => event.currentTarget.focus()}
        />
      </div>
    </div>
  )
}
