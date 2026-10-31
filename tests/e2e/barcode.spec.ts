import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import bwipjs from 'bwip-js'
import { choice, confirmDelete, rowFor, signIn } from './helpers'

// Codes the local product stub knows (see product-stub.mjs).
const NUTELLA = '3017624010701'
const JEERA_SEEDS = '4006381333931'
const DISH_SOAP = '5901234123457'
const UNKNOWN = '9780201379624'

function barcodePng(code: string) {
  return bwipjs.toBuffer({
    bcid: 'ean13',
    text: code,
    scale: 4,
    height: 22,
    includetext: true,
    paddingwidth: 24,
    paddingheight: 24,
    backgroundcolor: 'FFFFFF',
  })
}

// Replaces the camera with a stream that shows a printed barcode, so the real
// live-scanning code runs in CI without camera hardware.
async function showBarcodeToCamera(page: Page, code: string) {
  const image = `data:image/png;base64,${(await barcodePng(code)).toString('base64')}`
  await page.addInitScript((src) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const picture = new Image()
      picture.src = src
      await picture.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 480
      const context = canvas.getContext('2d') as CanvasRenderingContext2D
      const draw = () => {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        const scale = Math.min(560 / picture.width, 380 / picture.height)
        const width = picture.width * scale
        const height = picture.height * scale
        context.drawImage(picture, (640 - width) / 2, (480 - height) / 2, width, height)
      }
      draw()
      window.setInterval(draw, 100)
      return canvas.captureStream(10)
    }
  }, image)
}

async function blockCamera(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Permission denied', 'NotAllowedError')
    }
  })
}

const addDialog = (page: Page) => page.getByRole('dialog', { name: 'Add an item' })
const scanner = (page: Page) => page.getByRole('dialog', { name: 'Scan a barcode' })

test('scanning a new product fills the form, and scanning it again goes to Bought', async ({
  page,
}) => {
  await showBarcodeToCamera(page, NUTELLA)
  await signIn(page)

  await page.getByRole('button', { name: 'Scan', exact: true }).click()
  const dialog = addDialog(page)
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Nutella')
  await expect(choice(dialog, 'Category', 'Groceries')).toBeChecked()
  await expect(choice(dialog, 'Unit', 'g')).toBeChecked()
  await expect(dialog.getByLabel('Quantity at home')).toHaveValue('400')
  await expect(dialog.getByLabel(/^Notes/)).toHaveValue('Brand: Ferrero')
  await expect(dialog.locator('.scan-result')).toContainText('Filled in from Open Food Facts')
  await expect(dialog.locator('.barcode-line')).toContainText(NUTELLA)
  await expect(scanner(page)).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(rowFor(page, 'Nutella')).toBeVisible()

  await page.getByRole('button', { name: 'Scan', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Found Nutella' })).toBeVisible()
  await expect(page.locator('.action-row')).toContainText('How much did you buy?')
  await expect(page.locator('.quick-action input')).toBeFocused()
  await expect(addDialog(page)).not.toBeVisible()

  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await rowFor(page, 'Nutella').getByRole('button', { name: 'Delete', exact: true }).click()
  await confirmDelete(page, 'Nutella')
  await expect(rowFor(page, 'Nutella')).toHaveCount(0)
})

test('scanning a product you already have links its barcode to that item', async ({ page }) => {
  await showBarcodeToCamera(page, JEERA_SEEDS)
  await signIn(page)

  await page.getByRole('button', { name: 'Scan', exact: true }).click()
  const dialog = addDialog(page)
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Organic Jeera seeds')
  await dialog.getByRole('button', { name: 'This is my Jeera', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('status').filter({ hasText: 'Barcode linked to Jeera.' }),
  ).toBeVisible()
  await expect(page.locator('.action-row')).toContainText('How much did you buy?')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByRole('button', { name: 'Scan', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Found Jeera' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await rowFor(page, 'Jeera').getByRole('button', { name: 'Edit', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit Jeera' })
  await expect(edit.locator('.barcode-line')).toContainText(JEERA_SEEDS)
  await edit.getByRole('button', { name: 'Remove', exact: true }).click()
  await edit.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(edit).not.toBeVisible()

  await page.getByRole('button', { name: 'Scan', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'This is my Jeera' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close add item' }).click()
})

test('without camera access, a photo or a typed number still works', async ({ page }) => {
  await blockCamera(page)
  await signIn(page)

  await page.getByRole('button', { name: 'Scan', exact: true }).click()
  await expect(scanner(page)).toContainText('Camera access is blocked')
  await expect(scanner(page).locator('video')).toHaveCount(0)

  const typed = scanner(page).getByLabel('Or type the number under the barcode')
  await typed.fill('3017624010702')
  await scanner(page).getByRole('button', { name: 'Look up', exact: true }).click()
  await expect(scanner(page).getByRole('alert')).toContainText("That number doesn't look right")

  await scanner(page)
    .locator('.scanner-photo input')
    .setInputFiles({
      name: 'barcode.png',
      mimeType: 'image/png',
      buffer: await barcodePng(UNKNOWN),
    })
  const dialog = addDialog(page)
  await expect(dialog.locator('.scan-result')).toContainText("We don't know this product yet")
  await expect(dialog.locator('.barcode-line')).toContainText(UNKNOWN)
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('')

  await dialog.getByRole('button', { name: 'Remove', exact: true }).click()
  await dialog.getByRole('button', { name: /Scan it to fill this in/ }).click()
  await scanner(page).getByLabel('Or type the number under the barcode').fill('590 1234 123457')
  await scanner(page).getByRole('button', { name: 'Look up', exact: true }).click()

  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Dish soap')
  await expect(choice(dialog, 'Category', 'Household')).toBeChecked()
  await expect(choice(dialog, 'Unit', 'ml')).toBeChecked()
  await expect(dialog.getByLabel('Quantity at home')).toHaveValue('500')
  await expect(dialog.locator('.scan-result')).toContainText('Open Products Facts')
  await dialog.getByRole('button', { name: 'Close add item' }).click()
})

test('when product lookup is down, the form says so instead of "unknown product"', async ({
  page,
}) => {
  await blockCamera(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Scan', exact: true }).click()
  await scanner(page).getByLabel('Or type the number under the barcode').fill('5000112548167')
  await scanner(page).getByRole('button', { name: 'Look up', exact: true }).click()

  const dialog = addDialog(page)
  await expect(dialog.locator('.scan-result')).toContainText(
    'Product lookup is unavailable right now',
  )
  await expect(dialog.locator('.scan-result')).not.toContainText("We don't know this product")
  await expect(dialog.locator('.barcode-line')).toContainText('5000112548167')
  await dialog.getByRole('button', { name: 'Close add item' }).click()
})

test('a photo without a barcode explains what to try next', async ({ page }) => {
  await blockCamera(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Scan', exact: true }).click()

  const blank = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
    'base64',
  )
  await scanner(page)
    .locator('.scanner-photo input')
    .setInputFiles({ name: 'blank.png', mimeType: 'image/png', buffer: blank })
  await expect(scanner(page).getByRole('alert')).toContainText('No barcode found in that photo')
  await scanner(page).getByRole('button', { name: 'Close scanner' }).click()
  await expect(scanner(page)).toHaveCount(0)
})

test('phones show Scan next to Add item', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Add item', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
