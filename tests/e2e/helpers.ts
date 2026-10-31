import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export async function signIn(page: Page, role: 'admin' | 'family' = 'admin') {
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill(`${role}@homestock.local`)
  await page
    .getByLabel('Password', { exact: true })
    .fill(role === 'admin' ? 'Admin@1234' : 'Family@1234')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Inventory', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
}

export const rows = (page: Page) => page.locator('tbody tr.stock-row')
export const rowFor = (page: Page, name: string) =>
  page.locator('tbody tr.stock-row', { hasText: name })
export const compactRowFor = (page: Page, name: string) =>
  page.locator('.compact-row', { hasText: name })
export const shoppingEntry = (page: Page, name: string) =>
  page.locator('.shopping-items li', { hasText: name })

export const choice = (scope: Locator, group: string, option: string) =>
  scope
    .getByRole('group', { name: group, exact: true })
    .getByRole('radio', { name: option, exact: true })

// Answers the in-app "Delete …?" box after a Delete button was pressed.
export async function confirmDelete(page: Page, name: string) {
  const box = page.getByRole('dialog', { name: `Delete ${name}?` })
  await expect(box).toBeInViewport({ ratio: 1 })
  await box.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(box).toBeHidden()
}
