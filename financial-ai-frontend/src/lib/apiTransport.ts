import { auth } from './auth'
import { ApiError, httpClient } from './httpClient'

function withJsonHeaders(headers?: HeadersInit): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...headers,
  }
}

export function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  return httpClient.request<T>(path, {
    ...options,
    headers: withJsonHeaders(options?.headers),
  })
}

export async function requestWithOptionalAuth<T>(path: string, options?: RequestInit): Promise<T> {
  const token = auth.getAccessToken()

  try {
    return await httpClient.request<T>(path, {
      ...options,
      headers: withJsonHeaders({
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      }),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      auth.clear()
      if (typeof window !== 'undefined') window.location.href = '/login'
      throw new ApiError(401, 'Unauthorized')
    }
    throw error
  }
}