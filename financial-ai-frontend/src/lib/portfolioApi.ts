import { requestWithOptionalAuth } from './apiTransport'
import type { Asset } from './types'

export const portfolioApi = {
  getPortfolio() {
    return requestWithOptionalAuth<Asset[]>('/portfolio')
  },

  upsertAsset(body: { symbol: string; type: 'STOCK' | 'CRYPTO'; quantity: number; averageCost: number }) {
    return requestWithOptionalAuth<Asset>('/portfolio/assets', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  deleteAsset(id: string) {
    return requestWithOptionalAuth<null>(`/portfolio/assets/${id}`, { method: 'DELETE' })
  },
}