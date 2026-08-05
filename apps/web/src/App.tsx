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

  async function loadData(currentToken: string) {
    const [allItems, shopping] = await Promise.all([listItems(currentToken), shoppingList(currentToken)])
    setItems(allItems)
    setShop(shopping)
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

  async function reduce(item: StockItem) {
    if (!token) return

    const input = window.prompt(`Reduce ${item.name} by:`, '1')
    if (!input) return

    const value = Number(input)
    if (Number.isNaN(value) || value <= 0) {
      setError('Please enter a valid positive value')
      return
    }

    try {
      await adjustStock(token, item.id, -value, 'Manual reduce')
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reduce stock')
    }
  }

  async function add(item: StockItem) {
    if (!token) return

    const input = window.prompt(`Add stock to ${item.name}:`, '1')
    if (!input) return

    const value = Number(input)
    if (Number.isNaN(value) || value <= 0) {
      setError('Please enter a valid positive value')
      return
    }

    try {
      await adjustStock(token, item.id, value, 'Manual add')
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add stock')
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

  async function quickThreshold(item: StockItem) {
    if (!token) return
    const input = window.prompt(`Set threshold for ${item.name}:`, String(item.threshold))
    if (!input) return

    const value = Number(input)
    if (Number.isNaN(value) || value < 0) {
      setError('Please enter a valid threshold value')
      return
    }

    try {
      await updateItem(token, item.id, { threshold: value })
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update threshold')
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
                <small>
                  Need +{item.missingBy} {item.unit} (current {item.quantity}, threshold {item.threshold})
                </small>
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
                <tr key={item.id} className={item.quantity < item.threshold ? 'low' : ''}>
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
                      <button type="button" onClick={() => reduce(item)}>
                        Reduce
                      </button>
                      <button type="button" onClick={() => add(item)}>
                        Add
                      </button>
                      <button type="button" onClick={() => quickThreshold(item)}>
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
