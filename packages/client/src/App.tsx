import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  adjustStock,
  createItem,
  deleteItem,
  listItems,
  login,
  shoppingList,
  updateItem,
} from './api'
import './App.css'
import type { ItemCategory, MedicineFor, ShoppingItem, StockItem, Unit, User } from './types'
import { formatNeedText, isBelowThreshold } from './utils/stock.js'

const categories: ItemCategory[] = ['GROCERY', 'MEDICINE', 'HOUSEHOLD', 'OTHER']
const units: Unit[] = [
  'COUNT',
  'GRAM',
  'KILOGRAM',
  'MILLILITER',
  'LITER',
  'TABLET',
  'STRIP',
  'BOTTLE',
  'PACKET',
]
const medicineGroups: MedicineFor[] = ['ME', 'WIFE', 'BOTH', 'CHILD', 'FAMILY']
type QuickActionMode = 'REDUCE' | 'ADD' | 'THRESHOLD'

const emptyForm = {
  name: '',
  category: 'GROCERY' as ItemCategory,
  unit: 'GRAM' as Unit,
  quantity: 0,
  threshold: 0,
  notes: '',
  medicineFor: 'FAMILY' as MedicineFor,
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('hsm-token'))
  const [user, setUser] = useState<User | null>(
    JSON.parse(localStorage.getItem('hsm-user') ?? 'null') as User | null,
  )

  const [email, setEmail] = useState('admin@homestock.local')
  const [password, setPassword] = useState('Admin@1234')
  const [items, setItems] = useState<StockItem[]>([])
  const [shop, setShop] = useState<ShoppingItem[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<ItemCategory | 'ALL'>('ALL')
  const [form, setForm] = useState(emptyForm)
  const [quickActionItem, setQuickActionItem] = useState<StockItem | null>(null)
  const [quickActionMode, setQuickActionMode] = useState<QuickActionMode | null>(null)
  const [quickActionValue, setQuickActionValue] = useState('1')
  const [isQuickActionSaving, setIsQuickActionSaving] = useState(false)
  const [quickActionFeedback, setQuickActionFeedback] = useState('')

  async function loadData(currentToken: string) {
    const [allItems, shopping] = await Promise.all([listItems(currentToken), shoppingList(currentToken)])
    setItems(allItems)
    setShop(shopping)
  }

  function parseNumericInput(value: string) {
    return Number(value.trim().replace(',', '.'))
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    try {
      const res = await login(email, password)
      localStorage.setItem('hsm-token', res.token)
      localStorage.setItem('hsm-user', JSON.stringify(res.user))
      setToken(res.token)
      setUser(res.user)
      await loadData(res.token)
      setMessage('Login successful')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  function logout() {
    localStorage.removeItem('hsm-token')
    localStorage.removeItem('hsm-user')
    setToken(null)
    setUser(null)
    setItems([])
    setShop([])
  }

  useEffect(() => {
    if (!token) {
      return
    }

    loadData(token).catch(() => {
      logout()
    })
  }, [token])

  const filteredItems = useMemo(() => {
    if (filter === 'ALL') {
      return items
    }
    return items.filter((item) => item.category === filter)
  }, [items, filter])

  const medicineBuckets = useMemo(() => {
    return medicineGroups.map((group) => ({
      group,
      items: items.filter((item) => item.category === 'MEDICINE' && item.medicineFor === group),
    }))
  }, [items])

  async function submitCreate(e: FormEvent) {
    e.preventDefault()
    if (!token) return

    setError('')
    setMessage('')

    try {
      const payload = {
        ...form,
        medicineFor: form.category === 'MEDICINE' ? form.medicineFor : undefined,
      }

      await createItem(token, payload)
      setForm(emptyForm)
      await loadData(token)
      setMessage('Item added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    }
  }

  function openQuickAction(item: StockItem, mode: QuickActionMode) {
    setError('')
    setMessage('')
    setQuickActionFeedback('')
    setQuickActionItem(item)
    setQuickActionMode(mode)
    setQuickActionValue(mode === 'THRESHOLD' ? String(item.threshold) : '1')
  }

  function closeQuickAction() {
    setQuickActionItem(null)
    setQuickActionMode(null)
    setQuickActionValue('1')
    setQuickActionFeedback('')
    setIsQuickActionSaving(false)
  }

  async function applyQuickAction() {
    if (!token || !quickActionItem || !quickActionMode || isQuickActionSaving) return

    const value = parseNumericInput(quickActionValue)
    const requiresPositiveValue = quickActionMode === 'ADD' || quickActionMode === 'REDUCE'
    if (Number.isNaN(value) || (requiresPositiveValue && value <= 0) || (!requiresPositiveValue && value < 0)) {
      setError(
        quickActionMode === 'THRESHOLD'
          ? 'Please enter a valid threshold value'
          : 'Please enter a valid positive value',
      )
      return
    }

    setError('')
    setMessage('')
    setQuickActionFeedback('Applying update...')
    setIsQuickActionSaving(true)

    try {
      let updatedItem: StockItem
      if (quickActionMode === 'THRESHOLD') {
        updatedItem = await updateItem(token, quickActionItem.id, { threshold: value })
      } else {
        const delta = quickActionMode === 'REDUCE' ? -value : value
        updatedItem = await adjustStock(
          token,
          quickActionItem.id,
          delta,
          quickActionMode === 'REDUCE' ? 'Manual reduce' : 'Manual add',
        )
      }

      setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)))

      setQuickActionItem(updatedItem)
      setQuickActionFeedback('Updated. Refreshing latest values...')

      // Keep main inventory snappy; refresh shopping list separately.
      try {
        const updatedShopping = await shoppingList(token)
        setShop(updatedShopping)
      } catch {
        setMessage('Item updated. Shopping list will refresh on next reload.')
      }

      await loadData(token)

      setMessage('Item updated')
      setQuickActionFeedback('Update applied successfully.')
      setQuickActionValue(quickActionMode === 'THRESHOLD' ? String(updatedItem.threshold) : '1')
      setIsQuickActionSaving(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update item')
      setQuickActionFeedback('Update failed. Check the error message above.')
      setIsQuickActionSaving(false)
    }
  }

  async function remove(item: StockItem) {
    if (!token || user?.role !== 'ADMIN') return

    const confirmDelete = window.confirm(`Delete ${item.name}?`)
    if (!confirmDelete) return

    try {
      await deleteItem(token, item.id)
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete item')
    }
  }

  if (!token) {
    return (
      <main className="page auth-page">
        <section className="auth-card">
          <h1>Home Stock Manager</h1>
          <p>Track groceries, medicines, and household items with your family.</p>

          <form onSubmit={handleLogin} className="auth-form">
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </label>
            <button type="submit">Sign in</button>
          </form>

          <div className="hint">
            <div>Seed admin: admin@homestock.local / Admin@1234</div>
            <div>Seed family: family@homestock.local / Family@1234</div>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Home Stock Manager</h1>
          <p>
            Signed in as {user?.name} ({user?.role})
          </p>
        </div>
        <button onClick={logout} type="button">
          Logout
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="message">{message}</p> : null}

      <section className="panel grid-2">
        <article className="card">
          <h2>Add New Item</h2>
          <form onSubmit={submitCreate} className="item-form">
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </label>

            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as ItemCategory }))}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Unit
              <select
                value={form.unit}
                onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value as Unit }))}
              >
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
              />
            </label>

            <label>
              Threshold
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.threshold}
                onChange={(e) => setForm((prev) => ({ ...prev, threshold: Number(e.target.value) }))}
              />
            </label>

            {form.category === 'MEDICINE' ? (
              <label>
                For Whom
                <select
                  value={form.medicineFor}
                  onChange={(e) => setForm((prev) => ({ ...prev, medicineFor: e.target.value as MedicineFor }))}
                >
                  {medicineGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </label>

            <button type="submit">Create Item</button>
          </form>
        </article>

        <article className="card shopping">
          <h2>Shopping List (Below Threshold)</h2>
          {shop.length === 0 ? <p>All stock is above threshold.</p> : null}
          <ul>
            {shop.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <small>{formatNeedText(item.quantity, item.threshold, item.unit)}</small>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card">
        <h2>Inventory</h2>
        <div className="filters">
          <button
            type="button"
            className={filter === 'ALL' ? 'active' : ''}
            onClick={() => setFilter('ALL')}
          >
            ALL
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={filter === category ? 'active' : ''}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {quickActionItem && quickActionMode ? (
          <div className="quick-action" role="group" aria-label="Quick action">
            <span className="quick-action-title">
              {quickActionMode === 'ADD'
                ? `Add stock to ${quickActionItem.name}`
                : quickActionMode === 'REDUCE'
                  ? `Reduce stock from ${quickActionItem.name}`
                  : `Set threshold for ${quickActionItem.name}`}
            </span>
            <input
              aria-label="Action value"
              type="number"
              min={quickActionMode === 'THRESHOLD' ? '0' : '0.01'}
              step="0.01"
              value={quickActionValue}
              onChange={(e) => setQuickActionValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void applyQuickAction()
                }
              }}
              required
            />
            <button type="button" onClick={() => void applyQuickAction()} disabled={isQuickActionSaving}>
              {isQuickActionSaving ? 'Saving...' : 'Apply'}
            </button>
            <button type="button" onClick={closeQuickAction} disabled={isQuickActionSaving}>
              Cancel
            </button>
            {quickActionFeedback ? <small className="quick-action-feedback">{quickActionFeedback}</small> : null}
          </div>
        ) : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Threshold</th>
                <th>Medicine For</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={isBelowThreshold(item.quantity, item.threshold) ? 'low' : ''}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>
                    {item.quantity} {item.unit}
                  </td>
                  <td>
                    {item.threshold} {item.unit}
                  </td>
                  <td>{item.medicineFor ?? '-'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" onClick={() => openQuickAction(item, 'REDUCE')}>
                        Reduce
                      </button>
                      <button type="button" onClick={() => openQuickAction(item, 'ADD')}>
                        Add
                      </button>
                      <button type="button" onClick={() => openQuickAction(item, 'THRESHOLD')}>
                        Threshold
                      </button>
                      {user?.role === 'ADMIN' ? (
                        <button type="button" onClick={() => remove(item)}>
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Medicines Grouped By Person</h2>
        <div className="med-grid">
          {medicineBuckets.map((bucket) => (
            <article key={bucket.group}>
              <h3>{bucket.group}</h3>
              <ul>
                {bucket.items.map((item) => (
                  <li key={item.id}>
                    {item.name} - {item.quantity} {item.unit}
                  </li>
                ))}
                {bucket.items.length === 0 ? <li>No items</li> : null}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
