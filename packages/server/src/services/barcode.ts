// Retail barcodes (EAN-13, EAN-8, UPC-A, GTIN-14) end in a check digit. Normalising
// UPC-A and padded GTIN-14 to EAN-13 lets different scanners match the same product.
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(digits)) return null

  let code = digits
  if (code.length === 12) code = `0${code}`
  if (code.length === 14 && code.startsWith('0')) code = code.slice(1)
  if (![8, 13, 14].includes(code.length)) return null

  return hasValidCheckDigit(code) ? code : null
}

function hasValidCheckDigit(code: string): boolean {
  const digits = code.split('').map(Number)
  const checkDigit = digits.pop()
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === checkDigit
}
