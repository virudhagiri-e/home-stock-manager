export type UserRole = 'ADMIN' | 'FAMILY'

export type ItemCategory = 'GROCERY' | 'MEDICINE' | 'HOUSEHOLD' | 'OTHER'

export type Unit =
  'COUNT' | 'GRAM' | 'KILOGRAM' | 'MILLILITER' | 'LITER' | 'TABLET' | 'STRIP' | 'BOTTLE' | 'PACKET'

export type MedicineFor = 'ME' | 'WIFE' | 'CHILD' | 'FAMILY'

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
  barcode?: string | null
  createdAt: string
  updatedAt: string
}

export type ProductSuggestion = {
  name: string
  brand?: string
  quantity?: number
  unit?: Unit
  category: ItemCategory
  source: 'openfoodfacts' | 'openproductsfacts'
}

export type BarcodeLookup = {
  barcode: string
  source: 'inventory' | 'openfoodfacts' | 'openproductsfacts' | 'none' | 'unavailable'
  item: StockItem | null
  product: ProductSuggestion | null
  matches: StockItem[]
}

export type ShoppingItem = {
  id: string
  name: string
  category: ItemCategory
  unit: Unit
  quantity: number
  threshold: number
  missingBy: number
  outOfStock: boolean
  medicineFor?: MedicineFor | null
}
