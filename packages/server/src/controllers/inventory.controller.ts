import { Prisma, type ItemCategory } from '@prisma/client'
import type { Request, Response } from 'express'
import { type AuthenticatedRequest, requireAdmin } from '../middlewares/auth.js'
import { itemRepository } from '../repositories/item.repository.js'
import { barcodeSchema, invalidBarcodeMessage, itemSchema, stockAdjustSchema } from '../schemas.js'
import { findSimilarItems } from '../services/inventory.logic.js'
import { inventoryService } from '../services/inventory.service.js'
import { lookupProduct } from '../services/product-lookup.js'

const duplicateItemMessage =
  'An item with this name already exists in that category. Use a different name or category.'

function prismaErrorCode(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined
}

// Names the item already holding a barcode, so the user knows what to fix.
async function barcodeConflict(barcode: string | null | undefined, itemId?: string) {
  if (!barcode) return null
  const owner = await itemRepository.findByBarcode(barcode)
  return owner && owner.id !== itemId ? `This barcode is already linked to ${owner.name}.` : null
}

export const inventoryController = {
  async list(request: Request, response: Response) {
    const query = request.query as { category?: ItemCategory; lowStock?: string }
    const items = await inventoryService.listItems(query.category, query.lowStock === 'true')
    response.json(items)
  },

  async lookupBarcode(request: Request, response: Response) {
    const parsed = barcodeSchema.safeParse((request.params as { code: string }).code)
    if (!parsed.success) {
      response.status(400).json({ message: invalidBarcodeMessage })
      return
    }

    const barcode = parsed.data
    const item = await itemRepository.findByBarcode(barcode)
    if (item) {
      response.json({ barcode, source: 'inventory', item, product: null, matches: [] })
      return
    }

    const { product, unavailable } = await lookupProduct(barcode)
    const matches = product
      ? findSimilarItems(product.name, await itemRepository.listWithoutBarcode())
      : []
    const source = product?.source ?? (unavailable ? 'unavailable' : 'none')
    response.json({ barcode, source, item: null, product, matches })
  },

  async create(request: Request, response: Response) {
    const parsed = itemSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }

    const conflict = await barcodeConflict(parsed.data.barcode)
    if (conflict) {
      response.status(409).json({ message: conflict })
      return
    }

    try {
      const item = await inventoryService.createItem(parsed.data)
      response.status(201).json(item)
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') {
        response
          .status(409)
          .json({ message: (await barcodeConflict(parsed.data.barcode)) ?? duplicateItemMessage })
        return
      }
      throw error
    }
  },

  async update(request: Request, response: Response) {
    const { id } = request.params as { id: string }
    const parsed = itemSchema.partial().safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }

    const conflict = await barcodeConflict(parsed.data.barcode, id)
    if (conflict) {
      response.status(409).json({ message: conflict })
      return
    }

    try {
      const updated = await inventoryService.updateItem(id, parsed.data)
      response.json(updated)
    } catch (error) {
      const code = prismaErrorCode(error)
      if (code === 'P2002') {
        response.status(409).json({
          message: (await barcodeConflict(parsed.data.barcode, id)) ?? duplicateItemMessage,
        })
        return
      }
      if (code === 'P2025') {
        response.status(404).json({ message: 'Item not found' })
        return
      }
      throw error
    }
  },

  async adjustStock(request: Request, response: Response) {
    const authReq = request as AuthenticatedRequest
    const { id } = request.params as { id: string }

    const parsed = stockAdjustSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }

    const result = await inventoryService.adjustStock(
      id,
      authReq.user.sub,
      parsed.data.delta,
      parsed.data.reason,
    )

    if ('error' in result) {
      const code = result.error === 'Item not found' ? 404 : 400
      response.status(code).json({ message: result.error })
      return
    }

    response.json(result.item)
  },

  async remove(request: Request, response: Response) {
    const authReq = request as AuthenticatedRequest
    if (requireAdmin(authReq, response)) return

    const { id } = request.params as { id: string }
    await inventoryService.deleteItem(id)
    response.status(204).send()
  },

  async shoppingList(_request: Request, response: Response) {
    const items = await inventoryService.shoppingList()
    response.json(items)
  },

  async groupedMedicines(_request: Request, response: Response) {
    const grouped = await inventoryService.groupedMedicines()
    response.json(grouped)
  },
}
