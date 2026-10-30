import { describe, expect, it } from 'vitest'
import { isValidBarcode, normalizeBarcode } from './barcode.js'

describe('barcode utils', () => {
  it('accepts real retail barcodes and normalises UPC-A', () => {
    expect(normalizeBarcode('3017624010701')).toBe('3017624010701')
    expect(normalizeBarcode('96385074')).toBe('96385074')
    expect(normalizeBarcode('036000291452')).toBe('0036000291452')
  })

  it('catches typing mistakes with the check digit', () => {
    expect(isValidBarcode('3017624010702')).toBe(false)
    expect(isValidBarcode('30176240107')).toBe(false)
    expect(isValidBarcode('abc')).toBe(false)
  })
})
