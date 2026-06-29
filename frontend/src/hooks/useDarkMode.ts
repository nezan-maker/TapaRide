import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

function getStoredTheme(): Theme {
  try {
    return (localStorage.getItem('trek-theme') as Theme) || 'system'
  } catch {
    return 'system'
  }
}

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const isDark = theme === 'dark' || (theme === 'system' && getSystemDark())

  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useDarkMode() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    applyTheme(theme)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem('trek-theme', t)
    } catch {
      // ignore
    }
  }, [])

  const isDark = theme === 'dark' || (theme === 'system' && getSystemDark())

  return { theme, setTheme, isDark }
}
