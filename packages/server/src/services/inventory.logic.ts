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
