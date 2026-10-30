import type { BarcodeLookup, ShoppingItem, StockItem, User } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(body.message ?? 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function login(email: string, password: string) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function me(token: string) {
  return request<User>('/users/me', {}, token)
}

export async function listItems(token: string) {
  return request<StockItem[]>('/items', {}, token)
}

export async function createItem(token: string, data: Partial<StockItem>) {
  return request<StockItem>(
    '/items',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    token,
  )
}

export async function updateItem(token: string, id: string, data: Partial<StockItem>) {
  return request<StockItem>(
    `/items/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
    token,
  )
}

export async function adjustStock(token: string, id: string, delta: number, reason?: string) {
  return request<StockItem>(
    `/items/${id}/stock`,
    {
      method: 'PATCH',
      body: JSON.stringify({ delta, reason }),
    },
    token,
  )
}

export async function deleteItem(token: string, id: string) {
  return request<void>(
    `/items/${id}`,
    {
      method: 'DELETE',
    },
    token,
  )
}

export async function shoppingList(token: string) {
  return request<ShoppingItem[]>('/shopping-list', {}, token)
}

export async function lookupBarcode(token: string, code: string) {
  return request<BarcodeLookup>(`/barcodes/${encodeURIComponent(code)}`, {}, token)
}
