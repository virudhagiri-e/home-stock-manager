import { describe, expect, it } from 'vitest'
import { formatNeedText, isBelowThreshold, missingAmount } from './stock.js'

describe('stock utils', () => {
  it('detects below-threshold quantity', () => {
    expect(isBelowThreshold(2, 3)).toBe(true)
    expect(isBelowThreshold(3, 3)).toBe(false)
  })

  it('calculates missing amount with two decimals', () => {
    expect(missingAmount(1.111, 2)).toBe(0.89)
  })

  it('formats shopping hint text', () => {
    expect(formatNeedText(1, 2.5, 'kg')).toBe('Need +1.5 kg (current 1, threshold 2.5)')
  })
})
