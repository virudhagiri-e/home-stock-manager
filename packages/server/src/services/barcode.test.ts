import { describe, expect, it } from 'vitest'
import { normalizeBarcode } from './barcode.js'

describe('normalizeBarcode', () => {
  it('accepts valid EAN-13 and EAN-8 codes', () => {
    expect(normalizeBarcode('3017624010701')).toBe('3017624010701')
    expect(normalizeBarcode('96385074')).toBe('96385074')
  })

  it('stores UPC-A and padded GTIN-14 as EAN-13 so scanners agree', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452')
    expect(normalizeBarcode('03017624010701')).toBe('3017624010701')
  })

  it('ignores spaces and dashes typed by people', () => {
    expect(normalizeBarcode(' 3 017624 010701 ')).toBe('3017624010701')
    expect(normalizeBarcode('301-7624-010701')).toBe('3017624010701')
  })

  it('rejects typos caught by the check digit, letters and odd lengths', () => {
    expect(normalizeBarcode('3017624010702')).toBeNull()
    expect(normalizeBarcode('30176240107AB')).toBeNull()
    expect(normalizeBarcode('12345')).toBeNull()
    expect(normalizeBarcode('')).toBeNull()
  })
})
