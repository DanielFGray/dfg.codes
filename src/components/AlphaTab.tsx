import { useEffect, useId, useRef, useState, useCallback } from 'react'
import { AlphaTabApi, model, synth } from '@coderline/alphatab'
import { useColorScheme, getColors } from '../lib/alphatab-utils'
import { PlayerControls } from './AlphaTab/PlayerControls'
import { ProgressBar } from './AlphaTab/ProgressBar'
import { SpeedControl } from './AlphaTab/SpeedControl'
import { VolumeControl } from './AlphaTab/VolumeControl'
import { LoadingSpinner } from './AlphaTab/icons'

interface Props {
  tex: string
}

type PlayerState = 'loading' | 'ready' | 'playing' | 'paused'

interface PlayerPosition {
  currentSeconds: number
  endSeconds: number
  currentTick: number
  endTick: number
}

export function AlphaTexNotation({ tex }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const isDark = useColorScheme()
  const instanceId = `alphatab${useId().replace(/:/g, '-')}`

  // Player state
  const [playerState, setPlayerState] = useState<PlayerState>('loading')
  const [position, setPosition] = useState<PlayerPosition>({
    currentSeconds: 0,
    endSeconds: 0,
    currentTick: 0,
    endTick: 0,
  })
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [metronomeVolume, setMetronomeVolume] = useState(0) // 0 = off
  const [masterVolume, setMasterVolume] = useState(1)

  // Initialize AlphaTab API once
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Set tex as innerText BEFORE creating the API.
    // AlphaTab's initialRender() reads this and handles font-loading
    // and width timing internally — calling api.tex() manually bypasses
    // that and causes race conditions with multiple instances.
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
        staveProfile: 'Default',
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
        enableUserInteraction: true,
        soundFont: '/soundfont/sonivox.sf2',
        scrollElement: container,
      },
    })

    api.playerReady.on(() => {
      setPlayerState('ready')
    })

    api.playerStateChanged.on(e => {
      if (e.state === synth.PlayerState.Playing) {
        setPlayerState('playing')
      } else {
        setPlayerState(prev => (prev === 'loading' ? 'loading' : 'ready'))
      }
    })

    api.playerPositionChanged.on(e => {
      setPosition({
        currentSeconds: e.currentTime / 1000,
        endSeconds: e.endTime / 1000,
        currentTick: e.currentTick,
        endTick: e.endTick,
      })
    })

    api.error.on(error => {
      console.error(`[AlphaTab] Error in instance ${instanceId}:`, error)
    })

    apiRef.current = api

    return () => {
      apiRef.current = null
      api.destroy()
    }
  }, [tex]) // Only recreate when tex changes

  // Update colors when theme changes (without recreating the API)
  useEffect(() => {
    const api = apiRef.current
    if (!api) return

    const colors = getColors(isDark)
    const resources = api.settings.display.resources

    // Update the settings using Color.fromJson
    resources.mainGlyphColor = model.Color.fromJson(colors.mainColor)!
    resources.secondaryGlyphColor = model.Color.fromJson(colors.secondaryColor)!
    resources.scoreInfoColor = model.Color.fromJson(colors.mainColor)!
    resources.staffLineColor = model.Color.fromJson(colors.staffLineColor)!
    resources.barSeparatorColor = model.Color.fromJson(colors.barSeparatorColor)!

    // Apply settings and re-render
    api.updateSettings()
    api.render()
  }, [isDark])

  // Player controls
  const handlePlayPause = useCallback(() => {
    apiRef.current?.playPause()
  }, [])

  const handleStop = useCallback(() => {
    apiRef.current?.stop()
  }, [])

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed)
    if (apiRef.current) {
      apiRef.current.playbackSpeed = speed
    }
  }, [])

  const handleMetronomeToggle = useCallback(() => {
    const newVolume = metronomeVolume > 0 ? 0 : 1
    setMetronomeVolume(newVolume)
    if (apiRef.current) {
      apiRef.current.metronomeVolume = newVolume
    }
  }, [metronomeVolume])

  const handleVolumeChange = useCallback((volume: number) => {
    setMasterVolume(volume)
    if (apiRef.current) {
      apiRef.current.masterVolume = volume
    }
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const tick = parseInt(e.target.value, 10)
    if (apiRef.current) {
      apiRef.current.tickPosition = tick
    }
  }, [])

  const isLoading = playerState === 'loading'
  const isPlaying = playerState === 'playing'

  return (
    <div className="alphatab-wrapper" style={{ marginBottom: '2rem' }}>
      {/* Notation container */}
      <div
        ref={containerRef}
        className="alphatab-container"
        id={instanceId}
        style={{ minHeight: '200px', width: '100%' }}
      />

      {/* Player controls */}
      <div className="mt-3 rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
        {/* Main controls row */}
        <div className="flex items-center gap-3">
          <PlayerControls
            metronomeVolume={metronomeVolume}
            isLoading={isLoading}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onStop={handleStop}
            onMetronomeToggle={handleMetronomeToggle}
          />
          
          <ProgressBar
            currentSeconds={position.currentSeconds}
            endSeconds={position.endSeconds}
            currentTick={position.currentTick}
            endTick={position.endTick}
            isLoading={isLoading}
            onSeek={handleSeek}
          />
        </div>

        {/* Secondary controls row */}
        <div className="mt-3 flex items-center gap-4 border-t border-gray-200 pt-3 dark:border-gray-700">
          <SpeedControl
            playbackSpeed={playbackSpeed}
            isLoading={isLoading}
            onSpeedChange={handleSpeedChange}
          />
          
          <VolumeControl
            masterVolume={masterVolume}
            isLoading={isLoading}
            onVolumeChange={handleVolumeChange}
          />

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <LoadingSpinner />
              <span>Loading soundfont...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}