'use client'

import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type AuthenticatedChatMode = 'floating' | 'fullscreen' | 'collapsed'

export interface AuthenticatedChatWindowState {
  preferredMode: AuthenticatedChatMode
  effectiveMode: AuthenticatedChatMode
  isMobile: boolean | undefined
  setMode(mode: AuthenticatedChatMode): void
  restoreLastOpenMode(): void
  setIsMobile(mobile: boolean | undefined): void
}

const AuthenticatedChatContext = createContext<AuthenticatedChatWindowState | undefined>(undefined)

interface AuthenticatedChatProviderProps {
  children: ReactNode
}

export function AuthenticatedChatProvider({ children }: AuthenticatedChatProviderProps) {
  const [preferredMode, setPreferredMode] = useState<AuthenticatedChatMode>('floating')
  const [lastOpenMode, setLastOpenMode] = useState<Exclude<AuthenticatedChatMode, 'collapsed'>>('floating')
  const [isMobile, setIsMobileState] = useState<boolean | undefined>(undefined)

  // On mobile, always render fullscreen; on desktop, use preferred mode
  const effectiveMode: AuthenticatedChatMode = isMobile ? 'fullscreen' : preferredMode

  const setMode = useCallback((mode: AuthenticatedChatMode) => {
    setPreferredMode(mode)
    if (mode !== 'collapsed') {
      setLastOpenMode(mode)
    }
  }, [])

  const restoreLastOpenMode = useCallback(() => {
    setPreferredMode(lastOpenMode)
  }, [lastOpenMode])

  const setIsMobile = useCallback((mobile: boolean | undefined) => {
    setIsMobileState(mobile)
  }, [])

  const value = useMemo<AuthenticatedChatWindowState>(() => ({
    preferredMode,
    effectiveMode,
    isMobile,
    setMode,
    restoreLastOpenMode,
    setIsMobile,
  }), [effectiveMode, isMobile, preferredMode, restoreLastOpenMode, setIsMobile, setMode])

  return (
    <AuthenticatedChatContext.Provider value={value}>
      {children}
    </AuthenticatedChatContext.Provider>
  )
}

export function useAuthenticatedChatWindow(): AuthenticatedChatWindowState {
  const context = useContext(AuthenticatedChatContext)
  if (!context) {
    throw new Error('useAuthenticatedChatWindow must be used within AuthenticatedChatProvider')
  }
  return context
}
