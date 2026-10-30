import { describe, expect, it } from 'vitest'
import {
  formatNeedText,
  getStockStatus,
  isBelowThreshold,
  missingAmount,
  needsRestock,
} from './stock.js'

describe('stock utils', () => {
  it('detects below-threshold quantity', () => {
    expect(isBelowThreshold(2, 3)).toBe(true)
    expect(isBelowThreshold(3, 3)).toBe(false)
  })

  it('classifies stock as out, low, or ok', () => {
    expect(getStockStatus(0, 0)).toBe('OUT')
    expect(getStockStatus(0, 4)).toBe('OUT')
    expect(getStockStatus(1, 4)).toBe('LOW')
    expect(getStockStatus(4, 4)).toBe('OK')
    expect(getStockStatus(2, 0)).toBe('OK')
  })

  it('needs restocking when out of stock or running low', () => {
    expect(needsRestock(0, 0)).toBe(true)
    expect(needsRestock(1, 4)).toBe(true)
    expect(needsRestock(5, 4)).toBe(false)
  })

  it('calculates missing amount with two decimals', () => {
    expect(missingAmount(1.111, 2)).toBe(0.89)
  })

  it('formats shopping hint text', () => {
    expect(formatNeedText(1, 2.5, 'kg')).toBe('Need +1.5 kg (current 1, threshold 2.5)')
  })
})
