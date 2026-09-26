import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'ck-theme'
const ThemeContext = createContext(null)

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function ThemeProvider({ children }) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const [saved, setSaved] = useState(readSaved)
  const [systemDark, setSystemDark] = useState(media.matches)

  useEffect(() => {
    const onChange = (e) => setSystemDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [media])

  const theme = saved ?? (systemDark ? 'dark' : 'light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  /** 'light' | 'dark' | 'system' (follow the device). */
  const setPreference = (next) => {
    const value = next === 'system' ? null : next
    setSaved(value)
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Private mode: the choice still applies for this visit.
    }
  }

  const toggle = () => setPreference(theme === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggle, preference: saved ?? 'system', setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
