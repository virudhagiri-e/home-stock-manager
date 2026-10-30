export type StockStatus = 'OUT' | 'LOW' | 'OK'

export function isBelowThreshold(quantity: number, threshold: number): boolean {
  return quantity < threshold
}

export function isOutOfStock(quantity: number): boolean {
  return quantity <= 0
}

export function getStockStatus(quantity: number, threshold: number): StockStatus {
  if (isOutOfStock(quantity)) return 'OUT'
  if (isBelowThreshold(quantity, threshold)) return 'LOW'
  return 'OK'
}

export function needsRestock(quantity: number, threshold: number): boolean {
  return getStockStatus(quantity, threshold) !== 'OK'
}

export function missingAmount(quantity: number, threshold: number): number {
  return Number((threshold - quantity).toFixed(2))
}

export function formatNeedText(quantity: number, threshold: number, unit: string): string {
  return `Need +${missingAmount(quantity, threshold)} ${unit} (current ${quantity}, threshold ${threshold})`
}
