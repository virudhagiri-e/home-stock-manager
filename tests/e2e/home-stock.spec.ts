import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function signIn(page: Page, role: 'admin' | 'family' = 'admin') {
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill(`${role}@homestock.local`)
  await page
    .getByLabel('Password', { exact: true })
    .fill(role === 'admin' ? 'Admin@1234' : 'Family@1234')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your inventory' })).toHaveAttribute(
    'aria-busy',
    'false',
  )
}

test('login and view shopping list', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Shopping list', exact: true })).toBeVisible()
  await expect(page.locator('.shopping').getByText('Volini big tube')).toBeVisible()
  await expect(page.locator('.shopping').getByText('Pick up 4 pcs')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'A little care for everyone' })).toBeVisible()
  await expect(page).toHaveTitle('Home Stock Manager')
})

test('add inventory item and verify it appears in table', async ({ page }) => {
  await signIn(page)
  const itemName = `E2E Test Item ${Date.now()}`
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Name', { exact: true }).fill(itemName)
  await dialog.getByRole('combobox', { name: 'Category', exact: true }).selectOption('HOUSEHOLD')
  await dialog.getByRole('combobox', { name: 'Unit', exact: true }).selectOption('COUNT')
  await dialog.getByLabel('Quantity', { exact: true }).fill('2')
  await dialog.getByLabel('Minimum stock', { exact: true }).fill('1')
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Item added', { exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill(itemName)
  const row = page.locator('tbody tr', { hasText: itemName })
  await expect(row).toBeVisible()
  await expect(row.locator('.quantity')).toHaveText('2pcs')
  page.once('dialog', (confirmation) => confirmation.accept())
  await row.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(row).toHaveCount(0)
})

test('row actions update quantity and threshold and keep shopping list in sync', async ({
  page,
}) => {
  await signIn(page)
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill('Volini big tube')
  const row = page.locator('tbody tr', { hasText: 'Volini big tube' })
  const quantityCell = row.locator('td').nth(1)
  const thresholdCell = row.locator('td').nth(2)
  await expect(quantityCell).toContainText('0pcs')
  await expect(thresholdCell).toContainText('4 pcs')

  await row.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByLabel('Action value')).toBeFocused()
  await page.getByLabel('Action value').fill('2')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(quantityCell).toContainText('2pcs')

  await row.getByRole('button', { name: 'Reduce', exact: true }).click()
  await page.getByLabel('Action value').fill('1')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(quantityCell).toContainText('1pcs')

  await row.getByRole('button', { name: 'Threshold', exact: true }).click()
  await page.getByLabel('Action value').fill('3')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(thresholdCell).toContainText('3 pcs')
  await expect(page.locator('.shopping-items li', { hasText: 'Volini big tube' })).toContainText(
    'Pick up 2 pcs',
  )

  await row.getByRole('button', { name: 'Threshold', exact: true }).click()
  await page.getByLabel('Action value').fill('0')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.locator('.shopping-items li', { hasText: 'Volini big tube' })).toHaveCount(0)

  await row.getByRole('button', { name: 'Reduce', exact: true }).click()
  await page.getByLabel('Action value').fill('1')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(quantityCell).toContainText('0pcs')
  await row.getByRole('button', { name: 'Threshold', exact: true }).click()
  await page.getByLabel('Action value').fill('4')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(thresholdCell).toContainText('4 pcs')
})

test('new medicines appear in the right person group and shopping list', async ({ page }) => {
  await signIn(page)
  const itemName = `E2E Medicine ${Date.now()}`
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill(itemName)
  await dialog.getByRole('combobox', { name: 'Category', exact: true }).selectOption('MEDICINE')
  await dialog.getByRole('combobox', { name: 'Unit', exact: true }).selectOption('TABLET')
  await dialog.getByLabel('Quantity', { exact: true }).fill('2')
  await dialog.getByLabel('Minimum stock', { exact: true }).fill('5')
  await dialog.getByRole('combobox', { name: 'For whom', exact: true }).selectOption('CHILD')
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(dialog).not.toBeVisible()

  const medicine = page
    .locator('.person-medicines', { has: page.getByRole('heading', { name: /Child/ }) })
    .getByRole('listitem')
    .filter({ hasText: itemName })
  await expect(medicine).toContainText('2 tablets')
  await expect(medicine).toContainText('Low stock')
  await expect(page.locator('.shopping-items li', { hasText: itemName })).toContainText(
    'Pick up 3 tablets',
  )
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill(itemName)
  const row = page.locator('tbody tr', { hasText: itemName })
  await expect(row).toContainText('Medicines / Child')
  page.once('dialog', (confirmation) => confirmation.accept())
  await row.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(row).toHaveCount(0)
  await expect(medicine).toHaveCount(0)
})

test('search, category, and low-stock filters combine and reset', async ({ page }) => {
  await signIn(page)
  const inventory = page.getByRole('region', { name: 'Your inventory' })
  await inventory.getByRole('button', { name: 'Household', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await inventory.getByRole('button', { name: /^Low stock/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('Volini big tube')
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill('not-in-the-inventory')
  await expect(page.getByText('No matching essentials.')).toBeVisible()
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click()
  await expect(page.getByRole('searchbox', { name: 'Search inventory' })).toHaveValue('')
  await expect(inventory.getByRole('button', { name: 'All items', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(inventory.getByRole('button', { name: /^Low stock/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.locator('tbody tr')).toHaveCount(35)
})

test('add item dialog supports keyboard dismissal and medicine fields', async ({ page }) => {
  await signIn(page)
  const addButton = page.getByRole('button', { name: 'Add item', exact: true })
  await addButton.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Category', exact: true }).selectOption('MEDICINE')
  await expect(dialog.getByRole('combobox', { name: 'For whom', exact: true })).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Category', exact: true }).selectOption('GROCERY')
  await expect(dialog.getByRole('combobox', { name: 'For whom', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(addButton).toBeFocused()
})

test('family users can manage stock but cannot delete items', async ({ page }) => {
  await signIn(page, 'family')
  await expect(
    page.locator('tbody tr').first().getByRole('button', { name: 'Add', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
})

test('mobile layout keeps navigation, inventory, and dialogs within the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome home.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await signIn(page)
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('link', { name: /^Shopping list/ }).click()
  await expect(page.getByRole('link', { name: /^Shopping list/ })).toHaveAttribute(
    'aria-current',
    'location',
  )
  await expect(page.getByRole('heading', { name: 'Shopping list', exact: true })).toBeInViewport()
  await page.getByRole('link', { name: /^Inventory/ }).click()
  await expect(page.getByRole('link', { name: /^Inventory/ })).toHaveAttribute(
    'aria-current',
    'location',
  )
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeInViewport()
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await page.keyboard.press('Escape')
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  }
})

test('shows useful empty inventory and fully-stocked shopping states', async ({ page }) => {
  await page.route('**/items', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.continue(),
  )
  await page.route('**/shopping-list', (route) => route.fulfill({ json: [] }))
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Make room for your essentials.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: "You're all stocked up." })).toBeVisible()
  await page.getByRole('button', { name: 'Add your first item', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('keeps create errors inside the dialog and preserves entered values', async ({ page }) => {
  await signIn(page)
  await page.route('**/items', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 400, json: { message: 'An item with that name already exists.' } })
      : route.continue(),
  )
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('Jeera')
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('An item with that name already exists.')
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Jeera')
  await expect(dialog.getByRole('button', { name: 'Add item', exact: true })).toBeEnabled()
})
