import { prisma } from '../db.js'

export const stockEventRepository = {
  async saveStockAdjustment(data: {
    itemId: string
    userId: string
    delta: number
    afterValue: number
    reason?: string
  }) {
    return prisma.stockEvent.create({ data })
  },
}
