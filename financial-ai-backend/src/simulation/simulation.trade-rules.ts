interface PositionLike {
  quantity: unknown
  avgCost: unknown
}

export function calculateRealizedPnL(
  side: 'BUY' | 'SELL',
  existingPosition: PositionLike | null,
  fillPrice: number,
  quantity: number,
): number | null {
  if (side !== 'SELL' || !existingPosition) return null
  return (fillPrice - Number(existingPosition.avgCost)) * quantity
}

export function calculateBuyPositionState(
  existingPosition: PositionLike | null,
  fillPrice: number,
  quantity: number,
): { quantity: number; avgCost: number } {
  const existingQty = existingPosition ? Number(existingPosition.quantity) : 0
  const existingAvgCost = existingPosition ? Number(existingPosition.avgCost) : 0
  const nextQuantity = existingQty + quantity
  const nextAvgCost = existingQty === 0
    ? fillPrice
    : (existingQty * existingAvgCost + quantity * fillPrice) / nextQuantity

  return {
    quantity: nextQuantity,
    avgCost: nextAvgCost,
  }
}

export function calculateRemainingSellQuantity(
  existingPosition: PositionLike,
  quantity: number,
): number {
  return Number(existingPosition.quantity) - quantity
}