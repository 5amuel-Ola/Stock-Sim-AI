// Auth token helpers — thin wrapper around localStorage so components
// never reference localStorage keys directly.

const ACCESS_KEY = 'financial_ai_access_token'
const REFRESH_KEY = 'financial_ai_refresh_token'

export const auth = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(ACCESS_KEY)
  },

  setTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  },

  clear(): void {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },

  isLoggedIn(): boolean {
    return !!this.getAccessToken()
  },
}
