import { useEffect, useState } from 'react'

export function useColorScheme() {
  const [isDark, setIsDark] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return isDark
}

export function getColors(isDark: boolean) {
  return {
    mainColor: isDark ? '#e5e7eb' : '#111827', // gray-200 / gray-900
    secondaryColor: isDark ? '#9ca3af' : '#4b5563', // gray-400 / gray-600
    staffLineColor: isDark ? '#4b5563' : '#9ca3af',
    barSeparatorColor: '#6b7280',
  }
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}