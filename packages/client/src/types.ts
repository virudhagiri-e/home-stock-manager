export type UserRole = 'ADMIN' | 'FAMILY'

export type ItemCategory = 'GROCERY' | 'MEDICINE' | 'HOUSEHOLD' | 'OTHER'

export type Unit =
  | 'COUNT'
  | 'GRAM'
  | 'KILOGRAM'
  | 'MILLILITER'
  | 'LITER'
  | 'TABLET'
  | 'STRIP'
  | 'BOTTLE'
  | 'PACKET'

export type MedicineFor = 'ME' | 'WIFE' | 'BOTH' | 'CHILD' | 'FAMILY'

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
}

export type StockItem = {
  id: string
  name: string
  category: ItemCategory
  unit: Unit
  quantity: number
  threshold: number
  notes?: string | null
  medicineFor?: MedicineFor | null
  createdAt: string
  updatedAt: string
}

export type ShoppingItem = {
  id: string
  name: string
  category: ItemCategory
  unit: Unit
  quantity: number
  threshold: number
  missingBy: number
  medicineFor?: MedicineFor | null
}
