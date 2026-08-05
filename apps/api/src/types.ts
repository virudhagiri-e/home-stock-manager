import type { UserRole } from '@prisma/client'

export type JwtUser = {
  sub: string
  role: UserRole
  email: string
  name: string
}

export type ItemPayload = {
  name: string
  category: 'GROCERY' | 'MEDICINE' | 'HOUSEHOLD' | 'OTHER'
  unit:
    | 'COUNT'
    | 'GRAM'
    | 'KILOGRAM'
    | 'MILLILITER'
    | 'LITER'
    | 'TABLET'
    | 'STRIP'
    | 'BOTTLE'
    | 'PACKET'
  quantity: number
  threshold: number
  notes?: string
  medicineFor?: 'ME' | 'WIFE' | 'BOTH' | 'CHILD' | 'FAMILY'
}
