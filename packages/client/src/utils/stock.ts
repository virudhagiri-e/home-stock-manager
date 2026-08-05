export function isBelowThreshold(quantity: number, threshold: number): boolean {
  return quantity < threshold
}

export function missingAmount(quantity: number, threshold: number): number {
  return Number((threshold - quantity).toFixed(2))
}

export function formatNeedText(quantity: number, threshold: number, unit: string): string {
  return `Need +${missingAmount(quantity, threshold)} ${unit} (current ${quantity}, threshold ${threshold})`
}
