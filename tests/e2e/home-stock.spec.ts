import { expect, test } from '@playwright/test'

test('login and view shopping list', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Email').fill('admin@homestock.local')
  await page.getByLabel('Password').fill('Admin@1234')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'Shopping List (Below Threshold)' })).toBeVisible()
  await expect(page.locator('.shopping').getByText('Volini big tube')).toBeVisible()
})

test('add inventory item and verify it appears in table', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Email').fill('admin@homestock.local')
  await page.getByLabel('Password').fill('Admin@1234')
  await page.getByRole('button', { name: 'Sign in' }).click()

  const itemName = `E2E Test Item ${Date.now()}`

  await page.locator('form.item-form').getByLabel('Name').fill(itemName)
  await page.locator('form.item-form').getByLabel('Category').selectOption('HOUSEHOLD')
  await page.locator('form.item-form').getByLabel('Unit').selectOption('COUNT')
  await page.locator('form.item-form').getByLabel('Quantity').fill('2')
  await page.locator('form.item-form').getByLabel('Threshold').fill('1')
  await page.getByRole('button', { name: 'Create Item' }).click()

  await expect(page.getByText('Item added')).toBeVisible()
  await expect(page.getByRole('cell', { name: itemName })).toBeVisible()
})

test('row actions update quantity and threshold', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Email').fill('admin@homestock.local')
  await page.getByLabel('Password').fill('Admin@1234')
  await page.getByRole('button', { name: 'Sign in' }).click()

  const row = page.locator('tbody tr', {
    has: page.getByRole('cell', { name: 'Volini big tube' }),
  })

  const quantityCell = row.locator('td').nth(2)
  const thresholdCell = row.locator('td').nth(3)

  await expect(quantityCell).toContainText('0 COUNT')
  await expect(thresholdCell).toContainText('4 COUNT')

  await row.getByRole('button', { name: 'Add' }).click()
  await page.getByLabel('Action value').fill('2')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(quantityCell).toContainText('2 COUNT')

  await row.getByRole('button', { name: 'Reduce' }).click()
  await page.getByLabel('Action value').fill('1')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(quantityCell).toContainText('1 COUNT')

  await row.getByRole('button', { name: 'Threshold' }).click()
  await page.getByLabel('Action value').fill('3')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(thresholdCell).toContainText('3 COUNT')
})
