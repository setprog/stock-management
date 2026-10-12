// Light/dark theme: stored per browser, falls back to the OS setting.
import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'stock-mvp:theme'
const listeners = new Set()

function current() {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme() {
  document.documentElement.classList.toggle('dark', current() === 'dark')
}

export function useTheme() {
  const theme = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, current)
  const toggle = useCallback(() => {
    try { localStorage.setItem(KEY, current() === 'dark' ? 'light' : 'dark') } catch { /* ignore */ }
    applyTheme()
    listeners.forEach((l) => l())
  }, [])
  return { theme, toggle }
}
