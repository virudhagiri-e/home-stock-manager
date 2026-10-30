import type { ItemCategory, MedicineFor, Unit } from '@prisma/client'

type InventoryItem = {
  id: string
  name: string
  category: ItemCategory
  unit: Unit
  quantity: number
  threshold: number
  medicineFor: MedicineFor | null
}

export function isLowStock(item: Pick<InventoryItem, 'quantity' | 'threshold'>): boolean {
  return item.quantity < item.threshold
}

const ignoredWords = new Set(['and', 'the', 'with', 'for', 'pack', 'big', 'small'])

function nameWords(name: string) {
  return new Set(
    name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !ignoredWords.has(word) && !/^\d+$/.test(word)),
  )
}

// Suggests existing items that may be the scanned product, ranked by shared name words.
export function findSimilarItems<T extends Pick<InventoryItem, 'name'>>(
  productName: string,
  items: T[],
  limit = 3,
): T[] {
  const productWords = nameWords(productName)
  return items
    .map((item) => {
      const words = nameWords(item.name)
      const shared = [...words].filter((word) => productWords.has(word)).length
      return { item, score: words.size ? shared / words.size : 0 }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item)
}

export function isOutOfStock(item: Pick<InventoryItem, 'quantity'>): boolean {
  return item.quantity <= 0
}

// Out-of-stock items need buying even when no minimum has been set yet.
export function needsRestock(item: Pick<InventoryItem, 'quantity' | 'threshold'>): boolean {
  return isOutOfStock(item) || isLowStock(item)
}

export function buildShoppingList(items: InventoryItem[]) {
  return items
    .filter(needsRestock)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      threshold: item.threshold,
      missingBy: Number(Math.max(item.threshold - item.quantity, 0).toFixed(2)),
      outOfStock: isOutOfStock(item),
      medicineFor: item.medicineFor,
    }))
    .sort((a, b) => Number(b.outOfStock) - Number(a.outOfStock))
}

export function groupMedicinesByOwner(items: InventoryItem[]) {
  const grouped: Record<string, InventoryItem[]> = {
    ME: [],
    WIFE: [],
    BOTH: [],
    CHILD: [],
    FAMILY: [],
    UNKNOWN: [],
  }

  for (const item of items) {
    const key = item.medicineFor ?? 'UNKNOWN'
    grouped[key].push(item)
  }

  return grouped
}
