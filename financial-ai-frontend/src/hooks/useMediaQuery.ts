import { useEffect, useState } from 'react'

/**
 * Custom hook to detect media query matches at runtime.
 * Tracks viewport size changes and returns whether the query matches.
 *
 * @param query - CSS media query string
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(query)

    // Set initial value
    setMatches(mediaQuery.matches)

    // Define listener
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches)
    }

    // Attach listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange)
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange)
      } else {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [query])

  return matches
}

/**
 * Convenience hook to detect if viewport is mobile-sized.
 * Defaults to fullscreen chat on screens at or below 767px.
 */
export function useIsMobile(): boolean | undefined {
  return useMediaQuery('(max-width: 767px)')
}
