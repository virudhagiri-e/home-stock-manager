export function isValidBarcode(raw: string): boolean {
  return normalizeBarcode(raw) !== null
}

// Mirrors the server: retail barcodes end in a check digit, and UPC-A is stored as EAN-13.
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(digits)) return null

  let code = digits
  if (code.length === 12) code = `0${code}`
  if (code.length === 14 && code.startsWith('0')) code = code.slice(1)
  if (![8, 13, 14].includes(code.length)) return null

  const numbers = code.split('').map(Number)
  const checkDigit = numbers.pop()
  const sum = numbers
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === checkDigit ? code : null
}
