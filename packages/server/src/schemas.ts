import { z } from 'zod'
import { normalizeBarcode } from './services/barcode.js'

export const invalidBarcodeMessage =
  'That is not a valid barcode number. Check the digits printed under the barcode.'

export const barcodeSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const code = normalizeBarcode(value)
    if (!code) {
      ctx.addIssue({ code: 'custom', message: invalidBarcodeMessage })
      return z.NEVER
    }
    return code
  })

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'FAMILY']).optional(),
})

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
})

export const itemSchema = z.object({
  name: z.string().min(2),
  category: z.enum(['GROCERY', 'MEDICINE', 'HOUSEHOLD', 'OTHER']),
  unit: z.enum([
    'COUNT',
    'GRAM',
    'KILOGRAM',
    'MILLILITER',
    'LITER',
    'TABLET',
    'STRIP',
    'BOTTLE',
    'PACKET',
  ]),
  quantity: z.number().nonnegative(),
  threshold: z.number().nonnegative(),
  notes: z.string().max(500).optional(),
  medicineFor: z.enum(['ME', 'WIFE', 'CHILD', 'FAMILY']).optional(),
  barcode: barcodeSchema.nullable().optional(),
})

export const stockAdjustSchema = z.object({
  delta: z.number(),
  reason: z.string().max(160).optional(),
})
