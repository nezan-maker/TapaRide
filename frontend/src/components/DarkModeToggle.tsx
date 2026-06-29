import { useDarkMode } from '../hooks/useDarkMode'

export default function DarkModeToggle() {
  const { theme, setTheme } = useDarkMode()

  const cycle = () => {
    if (theme === 'system') setTheme('light')
    else if (theme === 'light') setTheme('dark')
    else setTheme('system')
  }

  const icon = theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'laptop'

  return (
    <button
      type="button"
      onClick={cycle}
      className="grid h-9 w-9 place-items-center rounded-xl border border-ink-100 text-ink-500 transition hover:bg-ink-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/10"
      aria-label={`Theme: ${theme}. Click to switch.`}
      title={`Theme: ${theme}`}
    >
      {icon === 'moon' && (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {icon === 'sun' && (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      )}
      {icon === 'laptop' && (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M2 20h20" />
        </svg>
      )}
    </button>
  )
}
