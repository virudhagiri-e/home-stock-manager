import type { ItemCategory, Unit } from '@prisma/client'
import { env } from '../config.js'

export type ProductSource = 'openfoodfacts' | 'openproductsfacts'

export type ProductSuggestion = {
  name: string
  brand?: string
  quantity?: number
  unit?: Unit
  category: ItemCategory
  source: ProductSource
}

type OpenFactsProduct = {
  product_name?: string
  product_name_en?: string
  generic_name?: string
  brands?: string
  product_quantity?: number | string
  product_quantity_unit?: string
  quantity?: string
}

const USER_AGENT = 'HomeStockManager/0.1 (+https://github.com/virudhagiri-e/home-stock-manager)'
const FIELDS =
  'product_name,product_name_en,generic_name,brands,product_quantity,product_quantity_unit,quantity'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { value: ProductSuggestion | null; expires: number }>()

const unitByLabel: Record<string, { unit: Unit; factor: number }> = {
  g: { unit: 'GRAM', factor: 1 },
  kg: { unit: 'KILOGRAM', factor: 1 },
  ml: { unit: 'MILLILITER', factor: 1 },
  cl: { unit: 'MILLILITER', factor: 10 },
  l: { unit: 'LITER', factor: 1 },
}

function parseAmount(value: number | string | undefined, unitLabel: string | undefined) {
  const amount = typeof value === 'string' ? Number(value.replace(',', '.')) : value
  const unit = unitLabel ? unitByLabel[unitLabel.trim().toLowerCase()] : undefined
  if (amount === undefined || Number.isNaN(amount) || amount <= 0 || !unit) return null
  return { quantity: Number((amount * unit.factor).toFixed(3)), unit: unit.unit }
}

export function mapOpenFactsProduct(
  product: OpenFactsProduct,
  category: ItemCategory,
  source: ProductSource,
): ProductSuggestion | null {
  const name = [product.product_name, product.product_name_en, product.generic_name]
    .map((value) => value?.trim())
    .find(Boolean)
  if (!name) return null

  const brand = product.brands?.split(',')[0]?.trim() || undefined
  const textAmount = product.quantity?.match(/^\s*([\d.,]+)\s*(kg|g|ml|cl|l)\b/i)
  const amount =
    parseAmount(product.product_quantity, product.product_quantity_unit) ??
    (textAmount ? parseAmount(textAmount[1], textAmount[2]) : null)

  return { name, brand, category, source, ...amount }
}

export type ProductLookupResult = {
  product: ProductSuggestion | null
  // True when a service failed, so "not found" cannot be trusted.
  unavailable: boolean
}

export async function lookupProduct(
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProductLookupResult> {
  const cached = cache.get(code)
  if (cached && cached.expires > Date.now()) return { product: cached.value, unavailable: false }

  const sources = [
    { base: env.OPEN_FOOD_FACTS_URL, source: 'openfoodfacts', category: 'GROCERY' },
    { base: env.OPEN_PRODUCTS_FACTS_URL, source: 'openproductsfacts', category: 'HOUSEHOLD' },
  ] as const

  // Only cache a "not found" when every source answered; outages should be retried.
  let everySourceAnswered = true
  for (const { base, source, category } of sources) {
    try {
      const response = await fetchImpl(`${base}/api/v2/product/${code}.json?fields=${FIELDS}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (response.status === 404) continue
      if (!response.ok) {
        everySourceAnswered = false
        continue
      }
      const body = (await response.json()) as { status?: number; product?: OpenFactsProduct }
      const suggestion =
        body.status === 1 && body.product
          ? mapOpenFactsProduct(body.product, category, source)
          : null
      if (suggestion) {
        cache.set(code, { value: suggestion, expires: Date.now() + CACHE_TTL_MS })
        return { product: suggestion, unavailable: false }
      }
    } catch {
      everySourceAnswered = false
    }
  }

  if (everySourceAnswered) cache.set(code, { value: null, expires: Date.now() + CACHE_TTL_MS })
  return { product: null, unavailable: !everySourceAnswered }
}

export function clearProductCache() {
  cache.clear()
}
