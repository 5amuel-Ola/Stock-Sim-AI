import { useEffect, useState } from 'react'

interface UseTypingAnimationOptions {
  text: string
  speed?: number
  enabled?: boolean
  onComplete?: () => void
}

/**
 * Custom hook for progressive character-by-character text reveal animation.
 * Animates text display over time by revealing one character at a time.
 *
 * @param options - Configuration for the typing animation
 * @returns The current animated text (from 0 to full text length)
 */
export function useTypingAnimation({
  text,
  speed = 15,
  enabled = true,
  onComplete,
}: UseTypingAnimationOptions): string {
  const [displayedText, setDisplayedText] = useState(enabled ? '' : text)

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text)
      return
    }

    setDisplayedText('')
  }, [text, enabled])

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (displayedText.length >= text.length) {
      // Animation is complete; fire completion callback
      onComplete?.()
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDisplayedText(text.slice(0, displayedText.length + 1))
    }, speed)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [displayedText, text, speed, enabled, onComplete])

  return displayedText
}
