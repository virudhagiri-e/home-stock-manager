import type { ItemCategory, MedicineFor, Unit } from '@prisma/client'
import { prisma } from '../db.js'

type CreateItemInput = {
  name: string
  category: ItemCategory
  unit: Unit
  quantity: number
  threshold: number
  notes?: string
  medicineFor?: MedicineFor
}

export const itemRepository = {
  list(category?: ItemCategory) {
    return prisma.stockItem.findMany({
      where: { category },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
  },

  listAllOrdered() {
    return prisma.stockItem.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
  },

  listMedicinesOrdered() {
    return prisma.stockItem.findMany({
      where: { category: 'MEDICINE' },
      orderBy: [{ medicineFor: 'asc' }, { name: 'asc' }],
    })
  },

  findById(id: string) {
    return prisma.stockItem.findUnique({ where: { id } })
  },

  create(data: CreateItemInput) {
    return prisma.stockItem.create({ data })
  },

  update(id: string, data: Partial<CreateItemInput>) {
    return prisma.stockItem.update({
      where: { id },
      data,
    })
  },

  delete(id: string) {
    return prisma.stockItem.delete({ where: { id } })
  },
}
