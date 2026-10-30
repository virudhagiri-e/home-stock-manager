import { describe, expect, it } from 'vitest'
import {
  buildShoppingList,
  groupMedicinesByOwner,
  isLowStock,
  isOutOfStock,
  needsRestock,
} from './inventory.logic.js'

describe('inventory.logic', () => {
  it('detects low stock based on threshold', () => {
    expect(isLowStock({ quantity: 2, threshold: 3 })).toBe(true)
    expect(isLowStock({ quantity: 3, threshold: 3 })).toBe(false)
  })

  it('treats zero quantity as out of stock and needing restock even without a minimum', () => {
    expect(isOutOfStock({ quantity: 0 })).toBe(true)
    expect(isOutOfStock({ quantity: 0.5 })).toBe(false)
    expect(needsRestock({ quantity: 0, threshold: 0 })).toBe(true)
    expect(needsRestock({ quantity: 1, threshold: 0 })).toBe(false)
    expect(needsRestock({ quantity: 1, threshold: 2 })).toBe(true)
  })

  it('puts out-of-stock items first, including ones without a minimum', () => {
    const list = buildShoppingList([
      {
        id: 'low',
        name: 'Jeera',
        category: 'GROCERY',
        unit: 'GRAM',
        quantity: 100,
        threshold: 250,
        medicineFor: null,
      },
      {
        id: 'new',
        name: 'Rice',
        category: 'GROCERY',
        unit: 'KILOGRAM',
        quantity: 0,
        threshold: 0,
        medicineFor: null,
      },
      {
        id: 'out',
        name: 'Volini',
        category: 'HOUSEHOLD',
        unit: 'COUNT',
        quantity: 0,
        threshold: 4,
        medicineFor: null,
      },
    ])

    expect(list.map((item) => item.id)).toEqual(['new', 'out', 'low'])
    expect(list[0]).toMatchObject({ outOfStock: true, missingBy: 0 })
    expect(list[1]).toMatchObject({ outOfStock: true, missingBy: 4 })
    expect(list[2]).toMatchObject({ outOfStock: false, missingBy: 150 })
  })

  it('builds shopping list with rounded missing amount', () => {
    const list = buildShoppingList([
      {
        id: '1',
        name: 'Jeera',
        category: 'GROCERY',
        unit: 'GRAM',
        quantity: 210.1,
        threshold: 300,
        medicineFor: null,
      },
      {
        id: '2',
        name: 'Dolo 650',
        category: 'MEDICINE',
        unit: 'TABLET',
        quantity: 30,
        threshold: 20,
        medicineFor: 'FAMILY',
      },
    ])

    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: '1',
      missingBy: 89.9,
    })
  })

  it('groups medicines by owner and unknown bucket', () => {
    const grouped = groupMedicinesByOwner([
      {
        id: '1',
        name: 'Iron India',
        category: 'MEDICINE',
        unit: 'TABLET',
        quantity: 10,
        threshold: 30,
        medicineFor: 'WIFE',
      },
      {
        id: '2',
        name: 'Cetirizine',
        category: 'MEDICINE',
        unit: 'TABLET',
        quantity: 50,
        threshold: 20,
        medicineFor: null,
      },
    ])

    expect(grouped.WIFE).toHaveLength(1)
    expect(grouped.UNKNOWN).toHaveLength(1)
  })
})
