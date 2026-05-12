// Fetches the user's portfolio (assets + live prices).
// Revalidates every 30 seconds so prices stay reasonably fresh.

import useSWR from 'swr'
import { portfolioApi } from '../lib/portfolioApi'
import type { Asset } from '../lib/types'

export function usePortfolio() {
  const { data, error, isLoading, mutate } = useSWR<Asset[]>(
    'portfolio',
    () => portfolioApi.getPortfolio(),
    { refreshInterval: 30_000 }
  )

  return {
    assets: data ?? [],
    error,
    isLoading,
    refresh: mutate,
  }
}
