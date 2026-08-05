import type { ItemCategory } from '@prisma/client'
import type { Request, Response } from 'express'
import { type AuthenticatedRequest, requireAdmin } from '../middlewares/auth.js'
import { itemSchema, stockAdjustSchema } from '../schemas.js'
import { inventoryService } from '../services/inventory.service.js'

export const inventoryController = {
  async list(request: Request, response: Response) {
    const query = request.query as { category?: ItemCategory; lowStock?: string }
    const items = await inventoryService.listItems(query.category, query.lowStock === 'true')
    response.json(items)
  },

  async create(request: Request, response: Response) {
    const parsed = itemSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }

    const item = await inventoryService.createItem(parsed.data)
    response.status(201).json(item)
  },

  async update(request: Request, response: Response) {
    const { id } = request.params as { id: string }
    const parsed = itemSchema.partial().safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }

    const updated = await inventoryService.updateItem(id, parsed.data)
    response.json(updated)
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
