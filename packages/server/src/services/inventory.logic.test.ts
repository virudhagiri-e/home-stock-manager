import { describe, expect, it } from 'vitest'
import { buildShoppingList, groupMedicinesByOwner, isLowStock } from './inventory.logic.js'

describe('inventory.logic', () => {
  it('detects low stock based on threshold', () => {
    expect(isLowStock({ quantity: 2, threshold: 3 })).toBe(true)
    expect(isLowStock({ quantity: 3, threshold: 3 })).toBe(false)
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
