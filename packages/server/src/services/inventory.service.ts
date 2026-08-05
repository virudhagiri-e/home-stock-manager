import type { ItemCategory, MedicineFor } from '@prisma/client'
import { prisma } from '../db.js'
import { itemRepository } from '../repositories/item.repository.js'
import { buildShoppingList, groupMedicinesByOwner, isLowStock } from './inventory.logic.js'

type CreateOrUpdateItem = {
  name?: string
  category?: ItemCategory
  unit?:
    | 'COUNT'
    | 'GRAM'
    | 'KILOGRAM'
    | 'MILLILITER'
    | 'LITER'
    | 'TABLET'
    | 'STRIP'
    | 'BOTTLE'
    | 'PACKET'
  quantity?: number
  threshold?: number
  notes?: string
  medicineFor?: MedicineFor
}

export const inventoryService = {
  async listItems(category?: ItemCategory, lowStockOnly = false) {
    const items = await itemRepository.list(category)
    if (!lowStockOnly) return items
    return items.filter(isLowStock)
  },

  async createItem(payload: Required<Pick<CreateOrUpdateItem, 'name' | 'category' | 'unit' | 'quantity' | 'threshold'>> & Pick<CreateOrUpdateItem, 'notes' | 'medicineFor'>) {
    const normalizedPayload = {
      ...payload,
      medicineFor: payload.category === 'MEDICINE' ? payload.medicineFor : undefined,
    }

    return itemRepository.create(normalizedPayload)
  },

  async updateItem(id: string, payload: CreateOrUpdateItem) {
    const normalizedPayload = { ...payload }
    if (normalizedPayload.category && normalizedPayload.category !== 'MEDICINE') {
      normalizedPayload.medicineFor = null as unknown as MedicineFor
    }
    return itemRepository.update(id, normalizedPayload)
  },

  async adjustStock(id: string, userId: string, delta: number, reason?: string) {
    const item = await itemRepository.findById(id)
    if (!item) {
      return { error: 'Item not found' as const }
    }

    const afterValue = item.quantity + delta
    if (afterValue < 0) {
      return { error: 'Stock cannot become negative' as const }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.stockItem.update({
        where: { id },
        data: { quantity: afterValue },
      })

      await tx.stockEvent.create({
        data: {
          itemId: id,
          userId,
          delta,
          afterValue,
          reason,
        },
      })

      return updatedItem
    })

    return { item: updated }
  },

  deleteItem(id: string) {
    return itemRepository.delete(id)
  },

  async shoppingList() {
    const items = await itemRepository.listAllOrdered()
    return buildShoppingList(items)
  },

  async groupedMedicines() {
    const items = await itemRepository.listMedicinesOrdered()
    return groupMedicinesByOwner(items)
  },
}
