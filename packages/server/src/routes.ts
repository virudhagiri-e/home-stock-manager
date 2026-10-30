import type { Express } from 'express'
import { Router } from 'express'
import { authController } from './controllers/auth.controller.js'
import { inventoryController } from './controllers/inventory.controller.js'
import { authenticate } from './middlewares/auth.js'

export function registerRoutes(app: Express) {
  const router = Router()

  router.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  router.post('/auth/login', authController.login)
  router.post('/auth/register', authenticate, authController.register)

  router.get('/users/me', authenticate, authController.me)

  router.get('/items', authenticate, inventoryController.list)
  router.post('/items', authenticate, inventoryController.create)
  router.patch('/items/:id', authenticate, inventoryController.update)
  router.patch('/items/:id/stock', authenticate, inventoryController.adjustStock)
  router.delete('/items/:id', authenticate, inventoryController.remove)

  router.get('/shopping-list', authenticate, inventoryController.shoppingList)
  router.get('/barcodes/:code', authenticate, inventoryController.lookupBarcode)
  router.get('/medicines/grouped', authenticate, inventoryController.groupedMedicines)

  app.use(router)
}
