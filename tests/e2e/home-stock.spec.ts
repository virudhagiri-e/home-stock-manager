import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  choice,
  compactRowFor,
  confirmDelete,
  rowFor,
  rows,
  shoppingEntry,
  signIn,
} from './helpers'

async function saveQuickAction(page: Page, value: string) {
  const input = page.locator('.quick-action input')
  await expect(input).toBeFocused()
  await input.fill(value)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.quick-action')).toHaveCount(0)
}

test('login and view shopping list', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Shopping list', exact: true })).toBeVisible()
  const volini = shoppingEntry(page, 'Volini big tube')
  await expect(volini).toContainText('Buy 4 pcs')
  await expect(volini).toContainText('Out of stock')
  const shopping = page.getByRole('complementary', { name: 'Shopping list' })
  await expect(shopping.locator('.shopping-group h3')).toHaveText([
    /^Groceries\s*6$/,
    /^Medicines\s*1$/,
    /^Household\s*1$/,
  ])
  await expect(shopping.getByRole('region', { name: 'Household to buy' })).toContainText(
    'Volini big tube',
  )
  await expect(page.getByRole('heading', { name: 'Medicines', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Home Stock Manager')
})

test('add inventory item and verify it appears in table', async ({ page }) => {
  await signIn(page)
  const itemName = `E2E Test Item ${Date.now()}`
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Name', { exact: true }).fill(itemName)
  await choice(dialog, 'Category', 'Household').check()
  await choice(dialog, 'Unit', 'pieces').check()
  await dialog.getByLabel('Quantity at home', { exact: true }).fill('2')
  await dialog.getByLabel('Minimum stock', { exact: true }).fill('1')
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: `${itemName} added.` })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill(itemName)
  const row = rowFor(page, itemName)
  await expect(row).toBeVisible()
  await expect(row.locator('.quantity')).toHaveText('2pcs')
  await expect(row).toContainText('In stock')
  await expect(shoppingEntry(page, itemName)).toHaveCount(0)
  await row.getByRole('button', { name: 'Delete', exact: true }).click()
  await page
    .getByRole('dialog', { name: `Delete ${itemName}?` })
    .getByRole('button', { name: 'Keep it', exact: true })
    .click()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Delete', exact: true }).click()
  await confirmDelete(page, itemName)
  await expect(row).toHaveCount(0)
})

test('an item added with only a name defaults to kg and goes on the shopping list', async ({
  page,
}) => {
  await signIn(page)
  const itemName = `E2E Name Only ${Date.now()}`
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(choice(dialog, 'Unit', 'kg')).toBeChecked()
  await dialog.getByLabel('Name', { exact: true }).fill(itemName)
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('status')).toContainText('on your shopping list')

  const listed = page
    .getByRole('region', { name: 'Groceries to buy' })
    .locator('li', { hasText: itemName })
  await expect(listed).toContainText('Out of stock')
  await expect(listed).toContainText('Buy more')
  await expect(listed).toContainText('Have 0 kg, minimum 0 kg')

  const inventory = page.getByRole('region', { name: 'Inventory', exact: true })
  await inventory.getByRole('button', { name: /^Out of stock/ }).click()
  const row = rowFor(page, itemName)
  await expect(row.locator('.quantity')).toHaveText('0kg')
  await expect(row.locator('.status-pill')).toHaveText('Out of stock')
  await expect(row.getByRole('button', { name: 'Used', exact: true })).toBeDisabled()

  await row.getByRole('button', { name: 'Delete', exact: true }).click()
  await confirmDelete(page, itemName)
  await expect(row).toHaveCount(0)
  await expect(listed).toHaveCount(0)
})

test('row actions update quantity and minimum and keep shopping list in sync', async ({ page }) => {
  await signIn(page)
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill('Volini big tube')
  const row = rowFor(page, 'Volini big tube')
  const quantityCell = row.locator('td').nth(1)
  const thresholdCell = row.locator('td').nth(2)
  const volini = shoppingEntry(page, 'Volini big tube')
  await expect(quantityCell).toContainText('0pcs')
  await expect(thresholdCell).toContainText('4 pcs')
  await expect(row.getByRole('button', { name: 'Used', exact: true })).toBeDisabled()

  await row.getByRole('button', { name: 'Bought', exact: true }).click()
  await expect(page.locator('.action-row')).toContainText('How much did you buy?')
  await saveQuickAction(page, '2')
  await expect(quantityCell).toContainText('2pcs')
  await expect(page.getByRole('status')).toContainText('Volini big tube: you now have 2 pcs.')
  await expect(volini).toContainText('Running low')
  await expect(volini).toContainText('Buy 2 pcs')

  await row.getByRole('button', { name: 'Used', exact: true }).click()
  await page.locator('.quick-action input').fill('5')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.quick-action').getByRole('alert')).toHaveText(
    'You only have 2 pcs. Enter 2 or less.',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await row.getByRole('button', { name: 'Used', exact: true }).click()
  await saveQuickAction(page, '1')
  await expect(quantityCell).toContainText('1pcs')

  await row.getByRole('button', { name: 'Change', exact: true }).click()
  await saveQuickAction(page, '3')
  await expect(thresholdCell).toContainText('3 pcs')
  await expect(volini).toContainText('Buy 2 pcs')

  await row.getByRole('button', { name: 'Change', exact: true }).click()
  await saveQuickAction(page, '0')
  await expect(volini).toHaveCount(0)

  await row.getByRole('button', { name: 'Used', exact: true }).click()
  await saveQuickAction(page, '1')
  await expect(quantityCell).toContainText('0pcs')
  await expect(volini).toContainText('Out of stock')
  await expect(volini).toContainText('Buy more')

  await row.getByRole('button', { name: 'Change', exact: true }).click()
  await saveQuickAction(page, '4')
  await expect(thresholdCell).toContainText('4 pcs')
  await expect(volini).toContainText('Buy 4 pcs')
})

test('new medicines appear in the right person group and shopping list', async ({ page }) => {
  await signIn(page)
  const itemName = `E2E Medicine ${Date.now()}`
  await page.getByRole('button', { name: 'Add medicine', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a medicine' })
  await expect(dialog.getByRole('group', { name: 'Category', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /Scan it/ })).toHaveCount(0)
  await dialog.getByLabel('Name', { exact: true }).fill(itemName)
  await choice(dialog, 'Unit', 'tablets').check()
  await dialog.getByLabel('Quantity at home', { exact: true }).fill('2')
  await dialog.getByLabel('Minimum stock', { exact: true }).fill('5')
  await choice(dialog, 'For whom', 'Child').check()
  await dialog.getByRole('button', { name: 'Add medicine', exact: true }).click()
  await expect(dialog).not.toBeVisible()

  const medicine = page
    .locator('.person-medicines', { has: page.getByRole('heading', { name: /Child/ }) })
    .getByRole('listitem')
    .filter({ hasText: itemName })
  await expect(
    medicine.getByRole('button', { name: `${itemName}, 2 tablets, running low. Edit` }),
  ).toBeVisible()
  await expect(shoppingEntry(page, itemName)).toContainText('Buy 3 tablets')
  await expect(shoppingEntry(page, itemName).locator('.shopping-person')).toHaveText('for Child')
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill(itemName)
  await expect(rowFor(page, itemName)).toHaveCount(0)

  await page.getByRole('searchbox', { name: 'Search medicines' }).fill(itemName)
  await expect(page.locator('.person-medicines')).toHaveCount(1)
  await medicine.locator('.compact-main').click()
  const edit = page.getByRole('dialog', { name: `Edit ${itemName}` })
  await edit.getByRole('button', { name: 'Delete', exact: true }).click()
  await confirmDelete(page, itemName)
  await expect(medicine).toHaveCount(0)
})

test('shopping list: Bought is prefilled with the amount to buy, and names open Edit', async ({
  page,
}) => {
  await signIn(page)
  const entry = shoppingEntry(page, 'Jaggery cubes Sweden')
  await expect(entry).toContainText('Buy 200 g')

  await entry.getByRole('button', { name: 'Bought', exact: true }).click()
  const input = page.locator('.shopping-action .quick-action input')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('200')
  await expect(page.locator('.action-row')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(entry).toHaveCount(0)
  await expect(rowFor(page, 'Jaggery cubes Sweden').locator('.quantity')).toHaveText('500g')

  await rowFor(page, 'Jaggery cubes Sweden')
    .getByRole('button', { name: 'Used', exact: true })
    .click()
  await page.locator('.quick-action input').fill('200')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(entry).toContainText('Buy 200 g')

  await shoppingEntry(page, 'Tamarind').locator('.shopping-main').click()
  const edit = page.getByRole('dialog', { name: 'Edit Tamarind' })
  await expect(edit).toBeVisible()
  await edit.getByRole('button', { name: 'Close edit item' }).click()
})

test('phones show medicines one per line with quick actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await page.getByRole('link', { name: 'Medicines' }).click()
  const medicines = page.getByRole('region', { name: 'Medicines', exact: true })
  await expect(medicines.locator('.compact-row')).toHaveCount(18)
  const heights = await medicines
    .locator('.compact-row')
    .evaluateAll((list) => list.map((row) => row.getBoundingClientRect().height))
  expect(Math.max(...heights)).toBeLessThan(80)

  const dolo = medicines.locator('.compact-row', { hasText: 'Dolo 650' })
  await dolo.getByRole('button', { name: 'Bought', exact: true }).click()
  await expect(medicines.locator('.compact-action .quick-action input')).toBeFocused()
  const amountBox = await medicines.locator('.compact-action .quick-action input').boundingBox()
  expect(amountBox!.width).toBeGreaterThanOrEqual(90)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await dolo.locator('.compact-main').click()
  const edit = page.getByRole('dialog', { name: 'Edit Dolo 650' })
  await expect(edit).toBeVisible()
  await expect(choice(edit, 'For whom', 'Family')).toBeChecked()
  await edit.getByRole('button', { name: 'Close edit item' }).click()
})

test('summary counts are links that filter the inventory and open the shopping list', async ({
  page,
}) => {
  await signIn(page)
  const overview = page.getByRole('region', { name: 'Inventory overview' })
  const inventory = page.getByRole('region', { name: 'Inventory', exact: true })

  await overview.getByRole('link', { name: /^Groceries 15/ }).click()
  await expect(inventory.getByRole('button', { name: 'Groceries 15' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(rows(page)).toHaveCount(15)
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeInViewport()

  await overview.getByRole('link', { name: /^Medicines 18/ }).click()
  await expect(page.getByRole('heading', { name: 'Medicines', exact: true })).toBeInViewport()

  await overview.getByRole('link', { name: /^Inventory 17/ }).click()
  await expect(rows(page)).toHaveCount(17)

  const toBuy = overview.getByRole('link', { name: /^To buy 8/ })
  await expect(toBuy).toContainText('1 out of stock, 7 running low')
  await toBuy.click()
  await expect(page.getByRole('heading', { name: 'Shopping list', exact: true })).toBeInViewport()
})

test('search, category, and stock filters combine and reset', async ({ page }) => {
  await signIn(page)
  const inventory = page.getByRole('region', { name: 'Inventory', exact: true })
  await inventory.getByRole('button', { name: 'Household 2' }).click()
  await expect(rows(page)).toHaveCount(2)
  await inventory.getByRole('button', { name: /^Out of stock/ }).click()
  await expect(rows(page)).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('Volini big tube')
  await inventory.getByRole('button', { name: /^Running low/ }).click()
  await expect(page.getByText('No matching essentials.')).toBeVisible()
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click()
  await expect(page.getByRole('searchbox', { name: 'Search inventory' })).toHaveValue('')
  await expect(inventory.getByRole('button', { name: 'Household 2' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(inventory.getByRole('button', { name: /^All items/ })).toHaveCount(0)
  await expect(inventory.getByRole('button', { name: 'Any stock', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(rows(page)).toHaveCount(17)
  await inventory.getByRole('button', { name: /^Running low/ }).click()
  await expect(rows(page)).toHaveCount(6)
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill('jaggery')
  await expect(rows(page)).toHaveCount(2)
})

test('category chips toggle: tap to filter, tap again to show everything', async ({ page }) => {
  await signIn(page)
  const inventory = page.getByRole('region', { name: 'Inventory', exact: true })
  const groceries = inventory.getByRole('button', { name: 'Groceries 15' })
  const household = inventory.getByRole('button', { name: 'Household 2' })
  await expect(inventory.getByRole('button', { name: /^Medicines/ })).toHaveCount(0)

  await groceries.click()
  await expect(groceries).toHaveAttribute('aria-pressed', 'true')
  await expect(rows(page)).toHaveCount(15)
  await household.click()
  await expect(groceries).toHaveAttribute('aria-pressed', 'false')
  await expect(rows(page)).toHaveCount(2)
  await household.click()
  await expect(household).toHaveAttribute('aria-pressed', 'false')
  await expect(rows(page)).toHaveCount(17)
})

test('add item dialog offers units and examples that fit each category', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const name = dialog.getByLabel('Name', { exact: true })
  const unitChips = dialog.getByRole('group', { name: 'Unit', exact: true }).getByRole('radio')
  await expect(dialog.locator('select')).toHaveCount(0)

  await expect(choice(dialog, 'Category', 'Groceries')).toBeChecked()
  await expect(dialog.getByLabel('Quantity at home', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Quantity at home', { exact: true })).toHaveAttribute(
    'placeholder',
    '0',
  )
  await expect(dialog.getByLabel('Minimum stock', { exact: true })).toHaveValue('')
  await expect(choice(dialog, 'Category', 'Medicines')).toHaveCount(0)
  await expect(choice(dialog, 'Unit', 'kg')).toBeChecked()
  await expect(unitChips).toHaveCount(7)
  await expect(choice(dialog, 'Unit', 'strips')).toHaveCount(0)

  await choice(dialog, 'Category', 'Household').check()
  await expect(choice(dialog, 'Unit', 'pieces')).toBeChecked()
  await expect(unitChips).toHaveCount(5)
  await expect(dialog.getByRole('group', { name: 'For whom', exact: true })).toHaveCount(0)
  await expect(name).toHaveAttribute('placeholder', 'e.g. Dishwasher tablets')
  await dialog.getByRole('button', { name: 'Close add item' }).click()

  await page.getByRole('button', { name: 'Add medicine', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Add a medicine' })).toBeVisible()
  await expect(choice(dialog, 'Unit', 'strips')).toBeChecked()
  await expect(dialog.getByRole('group', { name: 'Unit', exact: true })).toHaveText(
    /strips\s*tablets\s*bottles\s*packets/,
  )
  await expect(unitChips).toHaveCount(4)
  await expect(choice(dialog, 'For whom', 'Family')).toBeChecked()
  await expect(name).toHaveAttribute('placeholder', 'e.g. Paracetamol 500 mg')
})

test('editing a medicine moves it to another person and keeps its stock', async ({ page }) => {
  await signIn(page)
  const itemName = `E2E Edit Medicine ${Date.now()}`
  const renamed = `${itemName} 500 mg`
  await page.getByRole('button', { name: 'Add medicine', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill(itemName)
  await dialog.getByLabel('Quantity at home', { exact: true }).fill('3')
  await expect(dialog.getByRole('group', { name: 'For whom', exact: true })).toHaveText(
    /Alex\s*Robin\s*Child\s*Family/,
  )
  await choice(dialog, 'For whom', 'Robin').check()
  await dialog.getByRole('button', { name: 'Add medicine', exact: true }).click()
  await expect(dialog).not.toBeVisible()

  const personList = (person: RegExp) =>
    page.locator('.person-medicines', { has: page.getByRole('heading', { name: person }) })
  await expect(personList(/Robin/)).toContainText(itemName)

  await personList(/Robin/)
    .locator('.compact-row', { hasText: itemName })
    .locator('.compact-main')
    .click()
  await expect(dialog.getByRole('heading', { name: `Edit ${itemName}` })).toBeVisible()
  await expect(dialog.getByLabel('Quantity at home')).toHaveCount(0)
  await expect(choice(dialog, 'Unit', 'strips')).toBeChecked()
  await expect(choice(dialog, 'Category', 'Medicines')).toBeChecked()

  await dialog.getByLabel('Name', { exact: true }).fill('Dolo 650')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText(
    'An item with this name already exists in that category. Use a different name or category.',
  )

  await dialog.getByLabel('Name', { exact: true }).fill(renamed)
  await choice(dialog, 'For whom', 'Child').check()
  await choice(dialog, 'Unit', 'tablets').check()
  await dialog.getByLabel(/^Notes/).fill('Keep in the top drawer')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('status')).toContainText(`Saved changes to ${renamed}.`)

  const renamedRow = personList(/Child/).locator('.compact-row', { hasText: renamed })
  await expect(
    renamedRow.getByRole('button', { name: `${renamed}, 3 tablets. Edit` }),
  ).toBeVisible()
  await expect(personList(/Robin/)).not.toContainText(itemName)

  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Add an item' })).toBeVisible()
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: 'Close add item' }).click()

  await renamedRow.locator('.compact-main').click()
  await expect(dialog.getByLabel(/^Notes/)).toHaveValue('Keep in the top drawer')
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await confirmDelete(page, renamed)
  await expect(renamedRow).toHaveCount(0)
})

test('add item dialog supports keyboard dismissal; medicines have their own dialog', async ({
  page,
}) => {
  await signIn(page)
  const addButton = page.getByRole('button', { name: 'Add item', exact: true })
  await addButton.click()
  const dialog = page.getByRole('dialog')
  await expect(choice(dialog, 'Category', 'Medicines')).toHaveCount(0)
  await expect(dialog.getByRole('group', { name: 'For whom', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(addButton).toBeFocused()

  await page.getByRole('button', { name: 'Add medicine', exact: true }).click()
  await expect(dialog.getByRole('group', { name: 'For whom', exact: true })).toBeVisible()
  await expect(dialog.getByRole('group', { name: 'Category', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('family users can manage stock but cannot delete items', async ({ page }) => {
  await signIn(page, 'family')
  await expect(
    rows(page).first().getByRole('button', { name: 'Bought', exact: true }),
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
  await compactRowFor(page, 'Jeera').getByRole('button', { name: 'Bought', exact: true }).click()
  await expect(page.locator('.quick-action input')).toBeFocused()
  const actionBox = await page.locator('.quick-action').boundingBox()
  expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(390)
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  }
})

test('phones show one section per tab without duplicate shortcuts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  const inventory = page.getByRole('region', { name: 'Inventory', exact: true })
  const shopping = page.getByRole('complementary', { name: 'Shopping list' })
  const medicines = page.getByRole('region', { name: 'Medicines', exact: true })
  const nav = page.getByRole('navigation', { name: 'Main navigation' })

  await expect(page.getByRole('region', { name: 'Inventory overview' })).toBeHidden()
  await expect(inventory).toBeVisible()
  await expect(shopping).toBeHidden()
  await expect(medicines).toBeHidden()
  await expect(inventory.getByRole('button', { name: 'Groceries 15' })).toBeVisible()
  await expect(inventory.getByRole('button', { name: /^Other/ })).toHaveCount(0)

  const navBox = await nav.boundingBox()
  expect(navBox!.y + navBox!.height).toBeCloseTo(844, 0)
  await expect(nav.getByRole('link', { name: 'Shopping list 8' })).toBeVisible()
  await expect(nav.getByRole('link')).toHaveText([/^Inventory/, 'Medicines', /^Shopping list/])

  const addButton = page.getByRole('button', { name: 'Add item', exact: true })
  await expect(addButton).toBeInViewport()

  await nav.getByRole('link', { name: /^Shopping list/ }).click()
  await expect(shopping).toBeVisible()
  await expect(inventory).toBeHidden()
  await expect(addButton).toBeHidden()

  await nav.getByRole('link', { name: 'Medicines' }).click()
  await expect(medicines).toBeVisible()
  await expect(shopping).toBeHidden()

  await nav.getByRole('link', { name: /^Inventory/ }).click()
  await expect(inventory).toBeVisible()
  await expect(addButton).toBeVisible()
})

test('phones show one slim line per item, and tapping one opens Edit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  const inventory = page.getByRole('region', { name: 'Inventory', exact: true })

  await expect(page.locator('table')).toHaveCount(0)
  await expect(inventory.getByRole('group', { name: 'Filter by stock' })).toHaveCount(0)
  await expect(inventory.locator('.compact-row')).toHaveCount(17)
  await expect(inventory.getByRole('button', { name: 'Scan', exact: true })).toHaveText('')
  const heights = await inventory
    .locator('.compact-row')
    .evaluateAll((rowsList) => rowsList.map((row) => row.getBoundingClientRect().height))
  expect(Math.max(...heights)).toBeLessThan(80)

  const volini = compactRowFor(page, 'Volini big tube')
  await expect(volini).toHaveClass(/status-out/)
  await expect(volini).toContainText('0pcs')
  await expect(volini.getByRole('button', { name: 'Used', exact: true })).toBeDisabled()

  await compactRowFor(page, 'Asafoetida')
    .getByRole('button', { name: 'Bought', exact: true })
    .click()
  const amount = page.locator('.quick-action input')
  await expect(amount).toHaveValue('100')
  await amount.press('ArrowUp')
  await expect(amount).toHaveValue('150')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await compactRowFor(page, 'Jeera')
    .getByRole('button', { name: /^Jeera, 500 g/ })
    .click()
  const edit = page.getByRole('dialog', { name: 'Edit Jeera' })
  await expect(edit).toBeVisible()
  await expect(edit).toContainText('You have 500 g.')
  await expect(edit.getByLabel('Minimum stock', { exact: true })).toHaveValue('250')
  await edit.getByRole('button', { name: 'Close edit item' }).click()
  await expect(edit).toBeHidden()

  const itemName = `E2E Phone Delete ${Date.now()}`
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  const add = page.getByRole('dialog', { name: 'Add an item' })
  await add.getByLabel('Name', { exact: true }).fill(itemName)
  await add.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(add).toBeHidden()

  await compactRowFor(page, itemName).locator('.compact-main').click()
  const editNew = page.getByRole('dialog', { name: `Edit ${itemName}` })
  await expect(editNew).toContainText('You have 0 kg, out of stock.')
  await editNew.getByRole('button', { name: 'Delete', exact: true }).click()
  await confirmDelete(page, itemName)
  await expect(editNew).toBeHidden()
  await expect(compactRowFor(page, itemName)).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('family members do not see Delete in the edit form', async ({ page }) => {
  await signIn(page, 'family')
  await rowFor(page, 'Jeera').getByRole('button', { name: 'Edit', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit Jeera' })
  await expect(edit).toBeVisible()
  await expect(edit.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
  await edit.getByRole('button', { name: 'Close edit item' }).click()
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
