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

export function buildShoppingList(items: InventoryItem[]) {
  return items
    .filter(isLowStock)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      threshold: item.threshold,
      missingBy: Number((item.threshold - item.quantity).toFixed(2)),
      medicineFor: item.medicineFor,
    }))
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
