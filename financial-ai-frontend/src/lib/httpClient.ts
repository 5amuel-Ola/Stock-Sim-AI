const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const httpClient = {
  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, options)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const parsed = body as { error?: string; code?: string } & Record<string, unknown>
      throw new ApiError(
        res.status,
        parsed.error ?? `HTTP ${res.status}`,
        parsed.code,
        parsed,
      )
    }

    if (res.status === 204) return null as T
    return res.json() as Promise<T>
  },
}