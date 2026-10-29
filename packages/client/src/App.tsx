import { useEffect, useMemo, useRef, useState } from 'react'
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

const categoryLabels: Record<ItemCategory, string> = {
  GROCERY: 'Groceries',
  MEDICINE: 'Medicines',
  HOUSEHOLD: 'Household',
  OTHER: 'Other',
}
const unitLabels: Record<Unit, string> = {
  COUNT: 'pcs',
  GRAM: 'g',
  KILOGRAM: 'kg',
  MILLILITER: 'ml',
  LITER: 'l',
  TABLET: 'tablets',
  STRIP: 'strips',
  BOTTLE: 'bottles',
  PACKET: 'packets',
}
const personLabels: Record<MedicineFor, string> = {
  ME: 'Me',
  WIFE: 'Wife',
  BOTH: 'Both of us',
  CHILD: 'Child',
  FAMILY: 'Family',
}
const iconPaths = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Zm6 11v-8h6v8',
  inventory: 'M4 4h16v16H4zM4 10h16M10 10v10M8 7h8',
  basket: 'm3 9 2 11h14l2-11H3Zm5 0 4-6 4 6M9 13v3m6-3v3',
  medicine: 'm9 15 6-6m-9 9a5.7 5.7 0 0 1 0-8l4-4a5.7 5.7 0 0 1 8 8l-4 4a5.7 5.7 0 0 1-8 0Z',
  grocery: 'M12 21V10m0 5C4 16 3 10 3 5c6 0 9 3 9 7m0-2c0-5 4-7 9-7 0 6-2 10-9 10',
  household: 'M4 9h16v12H4zM3 4h18v5H3zM9 13h6',
  other: 'M5 5h4v4H5zm10 0h4v4h-4zM5 15h4v4H5zm10 0h4v4h-4z',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  threshold: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  logout: 'M9 4H4v16h5m5-13 5 5-5 5m-6-5h11',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  alert: 'M12 8v5m0 3v.1M3 20h18L12 3 3 20Z',
} as const
type IconName = keyof typeof iconPaths
const categoryIcons: Record<ItemCategory, IconName> = {
  GROCERY: 'grocery',
  MEDICINE: 'medicine',
  HOUSEHOLD: 'household',
  OTHER: 'other',
}

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={iconPaths[name]} />
    </svg>
  )
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Icon name="home" />
      </span>
      <span>
        Home Stock<span className="brand-caption">A well-kept home.</span>
      </span>
    </div>
  )
}

function PantryIllustration() {
  return (
    <svg className="pantry-illustration" viewBox="0 0 440 280" fill="none" aria-hidden="true">
      <rect x="36" y="34" width="368" height="226" rx="100" fill="#E8E3F5" />
      <path d="M56 157h328M56 249h328" stroke="#8475B3" strokeWidth="6" strokeLinecap="round" />
      <rect
        x="77"
        y="76"
        width="57"
        height="78"
        rx="12"
        fill="#FDFBF7"
        stroke="#B5A8D3"
        strokeWidth="2"
      />
      <rect x="80" y="68" width="51" height="13" rx="4" fill="#A99BC6" />
      <path d="M85 130c12-12 29 10 41-4v18H85v-14Z" fill="#DFB46F" />
      <path d="M85 113c12-12 29 10 41-4v19c-12 14-29-8-41 4v-19Z" fill="#EACB96" />
      <rect x="91" y="92" width="29" height="17" rx="4" fill="#F0EBE0" />
      <rect x="151" y="93" width="76" height="61" rx="10" fill="#C5D6C6" />
      <path d="M160 92v-9h58v9" fill="#64866D" />
      <rect x="173" y="108" width="32" height="29" rx="6" fill="#F7FAF4" />
      <path d="M181 123h16m-8-8v16" stroke="#64866D" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M264 154V92c-18-15-16-32-7-43 15 10 21 24 7 43Zm0-42c5-25 19-30 34-28-1 19-12 30-34 28Zm0-18c-24-2-32-14-31-30 18-1 30 10 31 30Z"
        fill="#71977B"
      />
      <path d="M243 123h44l-5 31h-34l-5-31Z" fill="#D6B895" />
      <rect x="314" y="97" width="44" height="57" rx="8" fill="#E1B9A5" />
      <rect x="318" y="90" width="36" height="10" rx="3" fill="#BA8F7A" />
      <path d="M325 119h22m-22 8h15" stroke="#FDF7F0" strokeWidth="3" strokeLinecap="round" />
      <path d="M80 185h91v61H80z" fill="#D2C7E4" />
      <path d="M76 177h99v14H76z" fill="#B4A3CF" />
      <rect x="108" y="203" width="35" height="18" rx="5" fill="#F6F2FA" />
      <rect
        x="193"
        y="183"
        width="48"
        height="63"
        rx="10"
        fill="#F8F5ED"
        stroke="#C9BFAB"
        strokeWidth="2"
      />
      <rect x="197" y="175" width="40" height="12" rx="4" fill="#7B8D7E" />
      <path d="M201 224h32v14h-32z" fill="#C3D0B7" />
      <rect x="267" y="190" width="84" height="56" rx="11" fill="#EDD7A2" />
      <path d="M267 205h84m-57-15v56m29-56v56" stroke="#D3B776" strokeWidth="2" />
      <path d="m348 49 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1 4-8Z" fill="#B4A3CF" />
    </svg>
  )
}

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
  const [search, setSearch] = useState('')
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [activeSection, setActiveSection] = useState(window.location.hash.slice(1) || 'inventory')
  const [isLoading, setIsLoading] = useState(Boolean(token))
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const createDialog = useRef<HTMLDialogElement>(null)
  const quickActionInput = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState(emptyForm)
  const [quickActionItem, setQuickActionItem] = useState<StockItem | null>(null)
  const [quickActionMode, setQuickActionMode] = useState<QuickActionMode | null>(null)
  const [quickActionValue, setQuickActionValue] = useState('1')
  const [isQuickActionSaving, setIsQuickActionSaving] = useState(false)
  const [quickActionFeedback, setQuickActionFeedback] = useState('')

  useEffect(() => {
    const updateSection = () => setActiveSection(window.location.hash.slice(1) || 'inventory')
    window.addEventListener('hashchange', updateSection)
    return () => window.removeEventListener('hashchange', updateSection)
  }, [])

  useEffect(() => {
    quickActionInput.current?.focus()
    quickActionInput.current?.select()
  }, [quickActionItem?.id, quickActionMode])

  async function loadData(currentToken: string) {
    const [allItems, shopping] = await Promise.all([
      listItems(currentToken),
      shoppingList(currentToken),
    ])
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
    setIsSigningIn(true)

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
    } finally {
      setIsSigningIn(false)
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

    setIsLoading(true)
    loadData(token)
      .catch((err: unknown) => {
        logout()
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load your inventory. Please sign in again.',
        )
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter(
      (item) =>
        (filter === 'ALL' || item.category === filter) &&
        (!onlyLowStock || isBelowThreshold(item.quantity, item.threshold)) &&
        `${item.name} ${item.notes ?? ''}`.toLowerCase().includes(query),
    )
  }, [items, filter, search, onlyLowStock])

  const lowStockCount = items.filter((item) =>
    isBelowThreshold(item.quantity, item.threshold),
  ).length
  const categoryCount = (category: ItemCategory) =>
    items.filter((item) => item.category === category).length

  function showCreateDialog() {
    setCreateError('')
    createDialog.current?.showModal()
  }

  const medicineBuckets = useMemo(() => {
    return medicineGroups.map((group) => ({
      group,
      items: items.filter((item) => item.category === 'MEDICINE' && item.medicineFor === group),
    }))
  }, [items])

  async function submitCreate(e: FormEvent) {
    e.preventDefault()
    if (!token || isCreating) return

    setError('')
    setMessage('')
    setCreateError('')
    setIsCreating(true)

    try {
      const payload = {
        ...form,
        medicineFor: form.category === 'MEDICINE' ? form.medicineFor : undefined,
      }

      await createItem(token, payload)
      setForm(emptyForm)
      await loadData(token)
      setMessage('Item added')
      createDialog.current?.close()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to add item. Please try again.')
    } finally {
      setIsCreating(false)
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
    if (
      Number.isNaN(value) ||
      (requiresPositiveValue && value <= 0) ||
      (!requiresPositiveValue && value < 0)
    ) {
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
      <main className="auth-page">
        <section className="auth-story" aria-label="About Home Stock">
          <Brand />
          <div className="auth-story-content">
            <PantryIllustration />
            <h1>
              A little order.
              <br />A calmer home.
            </h1>
            <p>
              From the pantry to the medicine cabinet, keep the everyday essentials in good supply.
            </p>
            <div className="auth-features">
              <span>
                <Icon name="grocery" /> Pantry staples
              </span>
              <span>
                <Icon name="medicine" /> Family medicines
              </span>
              <span>
                <Icon name="household" /> Home essentials
              </span>
            </div>
          </div>
          <p className="auth-story-footer">Less keeping track. More getting on with life.</p>
        </section>
        <section className="auth-form-panel">
          <div className="auth-card">
            <span className="welcome-icon">
              <Icon name="home" />
            </span>
            <h2>Welcome home.</h2>
            <p>Sign in to your family&apos;s shared stock space.</p>
            <form onSubmit={handleLogin} className="auth-form">
              <label>
                Email
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              {error ? (
                <p className="notice error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="primary-button sign-in-button"
                type="submit"
                disabled={isSigningIn}
              >
                {isSigningIn ? 'Signing in...' : 'Sign in'}
                <Icon name="arrow" />
              </button>
            </form>
            <details className="demo-access">
              <summary>Trying it locally? View demo accounts</summary>
              <p>Admin: admin@homestock.local / Admin@1234</p>
              <p>Family: family@homestock.local / Family@1234</p>
              <small>Demo accounts require the local seed data.</small>
            </details>
            <p className="auth-footnote">
              <Icon name="inventory" /> One home. One shared inventory.
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#inventory">
        Skip to inventory
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          <span className="workspace-dot" /> Your household
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <a
            className="nav-link"
            href="#inventory"
            aria-current={activeSection === 'inventory' ? 'location' : undefined}
          >
            <Icon name="inventory" />
            Inventory<span className="nav-count">{items.length}</span>
          </a>
          <a
            className="nav-link"
            href="#shopping"
            aria-current={activeSection === 'shopping' ? 'location' : undefined}
          >
            <Icon name="basket" />
            Shopping list
            {shop.length > 0 ? (
              <span className="nav-count warning-count">{shop.length}</span>
            ) : null}
          </a>
          <a
            className="nav-link"
            href="#medicines"
            aria-current={activeSection === 'medicines' ? 'location' : undefined}
          >
            <Icon name="medicine" />
            Medicines
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-note-icon">
            <Icon name="home" />
          </span>
          <strong>A home effort.</strong>
          <p>
            Everyone&apos;s essentials.
            <br />
            All in one place.
          </p>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{user?.name.charAt(0).toUpperCase() ?? 'H'}</span>
          <div>
            <strong>{user?.name ?? 'Household member'}</strong>
            <span>{user?.role === 'ADMIN' ? 'Administrator' : 'Family member'}</span>
          </div>
          <button
            className="icon-button logout-button"
            onClick={logout}
            type="button"
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Icon name="home" />
            <span>Your household</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Overview</strong>
          </div>
          <span className="shared-label">
            <span className="workspace-dot" /> Shared with your family
          </span>
        </header>
        <div className="page-content">
          <section className="page-heading" aria-labelledby="page-title">
            <div>
              <h1 id="page-title">A well-stocked home starts here.</h1>
              <p>A little less to remember. Everything you need, in one place.</p>
            </div>
            <button className="primary-button" type="button" onClick={showCreateDialog}>
              <Icon name="plus" />
              Add item
            </button>
          </section>

          {error ? (
            <p className="notice error" role="alert">
              <Icon name="alert" />
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="notice message" role="status">
              <Icon name="check" />
              {message}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setMessage('')}
              >
                <Icon name="close" />
              </button>
            </p>
          ) : null}

          <section className="summary-grid" aria-label="Inventory overview">
            <button
              className={`summary-card ${filter === 'ALL' ? 'selected' : ''}`}
              onClick={() => setFilter('ALL')}
              aria-pressed={filter === 'ALL'}
            >
              <span className="summary-icon all">
                <Icon name="inventory" />
              </span>
              <span className="summary-copy">
                <span>All essentials</span>
                <strong>{isLoading ? '...' : items.length}</strong>
                <small>Items in your home</small>
              </span>
            </button>
            {(['GROCERY', 'MEDICINE', 'HOUSEHOLD'] as const).map((category) => (
              <button
                key={category}
                className={`summary-card ${filter === category ? 'selected' : ''}`}
                onClick={() => setFilter(category)}
                aria-pressed={filter === category}
              >
                <span className={`summary-icon ${category.toLowerCase()}`}>
                  <Icon name={categoryIcons[category]} />
                </span>
                <span className="summary-copy">
                  <span>{categoryLabels[category]}</span>
                  <strong>{isLoading ? '...' : categoryCount(category)}</strong>
                  <small>
                    {category === 'GROCERY'
                      ? 'Pantry & kitchen'
                      : category === 'MEDICINE'
                        ? 'Care for the family'
                        : 'Everyday home supplies'}
                  </small>
                </span>
              </button>
            ))}
          </section>

          {!isLoading && lowStockCount > 0 ? (
            <div className="restock-banner">
              <span className="restock-icon">
                <Icon name="basket" />
              </span>
              <p>
                <strong>A few things need a top-up.</strong>
                <span>
                  {lowStockCount} {lowStockCount === 1 ? 'item is' : 'items are'} below your minimum
                  stock level.
                </span>
              </p>
              <a href="#shopping">
                View shopping list
                <Icon name="arrow" />
              </a>
            </div>
          ) : null}

          <div className="inventory-layout">
            <section
              className="inventory-panel surface"
              id="inventory"
              aria-labelledby="inventory-title"
              aria-busy={isLoading}
            >
              <div className="section-heading">
                <div>
                  <h2 id="inventory-title">
                    Your inventory <span className="heading-count">{items.length}</span>
                  </h2>
                  <p>The everyday things that keep home running.</p>
                </div>
              </div>
              <div className="inventory-toolbar">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    aria-label="Search inventory"
                    type="search"
                    placeholder="Find an essential..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button
                  className={`stock-filter ${onlyLowStock ? 'active' : ''}`}
                  type="button"
                  aria-pressed={onlyLowStock}
                  onClick={() => setOnlyLowStock(!onlyLowStock)}
                >
                  <span className="status-dot" />
                  Low stock<span>{lowStockCount}</span>
                </button>
              </div>
              <div className="filters" aria-label="Filter by category">
                <button
                  type="button"
                  className={filter === 'ALL' ? 'active' : ''}
                  aria-pressed={filter === 'ALL'}
                  onClick={() => setFilter('ALL')}
                >
                  All items
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={filter === category ? 'active' : ''}
                    aria-pressed={filter === category}
                    onClick={() => setFilter(category)}
                  >
                    {categoryLabels[category]}
                  </button>
                ))}
              </div>

              {quickActionItem && quickActionMode ? (
                <div className="quick-action" role="group" aria-label="Quick action">
                  <div className="quick-action-heading">
                    <span className="quick-action-title">
                      {quickActionMode === 'ADD'
                        ? `Add stock to ${quickActionItem.name}`
                        : quickActionMode === 'REDUCE'
                          ? `Reduce stock from ${quickActionItem.name}`
                          : `Set threshold for ${quickActionItem.name}`}
                    </span>
                    <span>
                      Current: {quickActionItem.quantity} {unitLabels[quickActionItem.unit]}
                      <span className="quick-action-divider">/</span>Minimum:{' '}
                      {quickActionItem.threshold} {unitLabels[quickActionItem.unit]}
                    </span>
                  </div>
                  <div className="quick-action-controls">
                    <input
                      ref={quickActionInput}
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
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void applyQuickAction()}
                      disabled={isQuickActionSaving}
                    >
                      {isQuickActionSaving ? 'Saving...' : 'Apply'}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={closeQuickAction}
                      disabled={isQuickActionSaving}
                    >
                      Cancel
                    </button>
                  </div>
                  {quickActionFeedback ? (
                    <small className="quick-action-feedback" role="status">
                      {quickActionFeedback}
                    </small>
                  ) : null}
                </div>
              ) : null}

              <div className="table-wrap" role="region" aria-label="Inventory table" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">In stock</th>
                      <th scope="col">Minimum</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const low = isBelowThreshold(item.quantity, item.threshold)
                      const stockPercent =
                        item.threshold > 0
                          ? Math.min(100, (item.quantity / (item.threshold * 2)) * 100)
                          : item.quantity > 0
                            ? 100
                            : 0
                      return (
                        <tr key={item.id} className={low ? 'low' : ''}>
                          <td>
                            <div className="item-identity">
                              <span className={`item-icon ${item.category.toLowerCase()}`}>
                                <Icon name={categoryIcons[item.category]} />
                              </span>
                              <div>
                                <span className="item-name">{item.name}</span>
                                <span className="item-meta">
                                  {categoryLabels[item.category]}
                                  {item.medicineFor ? ` / ${personLabels[item.medicineFor]}` : ''}
                                </span>
                                {item.notes ? (
                                  <span className="item-notes">{item.notes}</span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`quantity ${low ? 'quantity-low' : ''}`}>
                              {item.quantity}
                              <small>{unitLabels[item.unit]}</small>
                            </span>
                            <span className={`stock-track ${low ? 'stock-track-low' : ''}`}>
                              <span style={{ width: `${stockPercent}%` }} />
                            </span>
                            <span className={`stock-status ${low ? 'stock-status-low' : ''}`}>
                              {item.quantity === 0
                                ? 'Out of stock'
                                : low
                                  ? 'Running low'
                                  : 'In good supply'}
                            </span>
                          </td>
                          <td>
                            <span className="minimum-quantity">
                              {item.threshold} <small>{unitLabels[item.unit]}</small>
                            </span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <div className="quantity-actions">
                                <button
                                  type="button"
                                  onClick={() => openQuickAction(item, 'REDUCE')}
                                  disabled={isQuickActionSaving}
                                  aria-label="Reduce"
                                  title={`Reduce ${item.name}`}
                                >
                                  <Icon name="minus" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openQuickAction(item, 'ADD')}
                                  disabled={isQuickActionSaving}
                                  aria-label="Add"
                                  title={`Add stock to ${item.name}`}
                                >
                                  <Icon name="plus" />
                                </button>
                              </div>
                              <button
                                className="icon-button"
                                type="button"
                                onClick={() => openQuickAction(item, 'THRESHOLD')}
                                disabled={isQuickActionSaving}
                                aria-label="Threshold"
                                title={`Set minimum stock for ${item.name}`}
                              >
                                <Icon name="threshold" />
                              </button>
                              {user?.role === 'ADMIN' ? (
                                <button
                                  className="icon-button delete-button"
                                  type="button"
                                  onClick={() => void remove(item)}
                                  disabled={isQuickActionSaving}
                                  aria-label="Delete"
                                  title={`Delete ${item.name}`}
                                >
                                  <Icon name="trash" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {isLoading ? (
                <div className="empty-state" role="status">
                  <span className="loading-dot" />
                  <p>Getting your household ready...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="empty-state">
                  <Icon name={items.length === 0 ? 'inventory' : 'search'} />
                  <h3>
                    {items.length === 0
                      ? 'Make room for your essentials.'
                      : 'No matching essentials.'}
                  </h3>
                  <p>
                    {items.length === 0
                      ? 'Add your first item to start keeping track.'
                      : 'Try a different search or reset your filters.'}
                  </p>
                  <button
                    className="secondary-button"
                    onClick={
                      items.length === 0
                        ? showCreateDialog
                        : () => {
                            setSearch('')
                            setFilter('ALL')
                            setOnlyLowStock(false)
                          }
                    }
                  >
                    {items.length === 0 ? 'Add your first item' : 'Reset filters'}
                  </button>
                </div>
              ) : null}
              <div className="inventory-footer">
                <span>
                  Showing {filteredItems.length} of {items.length} items
                </span>
                <span>
                  <span className="status-dot" />
                  Below minimum stock
                </span>
              </div>
            </section>

            <aside className="shopping surface" id="shopping" aria-labelledby="shopping-title">
              <div className="shopping-heading">
                <span className="shopping-heading-icon">
                  <Icon name="basket" />
                </span>
                <span className="shopping-count">{shop.length} to pick up</span>
              </div>
              <h2 id="shopping-title">Shopping list</h2>
              <p className="section-description">A handy list for your next shop.</p>
              {isLoading ? (
                <p className="shopping-empty" role="status">
                  Checking your essentials...
                </p>
              ) : shop.length === 0 ? (
                <div className="shopping-empty">
                  <span className="stocked-icon">
                    <Icon name="check" />
                  </span>
                  <h3>You&apos;re all stocked up.</h3>
                  <p>Items appear here when they fall below their minimum.</p>
                </div>
              ) : (
                <ul className="shopping-items">
                  {shop.map((item) => (
                    <li key={item.id}>
                      <span className={`shopping-item-icon ${item.category.toLowerCase()}`}>
                        <Icon name={categoryIcons[item.category]} />
                      </span>
                      <div>
                        <strong>{item.name}</strong>
                        <span
                          title={formatNeedText(
                            item.quantity,
                            item.threshold,
                            unitLabels[item.unit],
                          )}
                        >
                          Pick up {item.missingBy} {unitLabels[item.unit]}
                        </span>
                        <small>
                          {item.quantity} {unitLabels[item.unit]} left at home
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="shopping-note">
                <Icon name="check" />
                <p>
                  Always up to date.
                  <br />
                  <span>Your list follows your stock levels.</span>
                </p>
              </div>
            </aside>
          </div>

          <section
            className="medicine-panel surface"
            id="medicines"
            aria-labelledby="medicine-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="medicine-title">
                  <Icon name="medicine" />A little care for everyone
                </h2>
                <p>Your family&apos;s medicines, organised by person.</p>
              </div>
              <span className="subtle-badge">{categoryCount('MEDICINE')} medicines</span>
            </div>
            <div className="med-grid">
              {medicineBuckets.map((bucket) => (
                <article key={bucket.group} className="person-medicines">
                  <h3>
                    <span className={`person-avatar person-${bucket.group.toLowerCase()}`}>
                      {personLabels[bucket.group].charAt(0)}
                    </span>
                    {personLabels[bucket.group]}
                    <span className="person-count">{bucket.items.length}</span>
                  </h3>
                  <ul>
                    {bucket.items.map((item) => (
                      <li key={item.id}>
                        <span>{item.name}</span>
                        <small
                          className={
                            isBelowThreshold(item.quantity, item.threshold) ? 'quantity-low' : ''
                          }
                        >
                          {item.quantity} {unitLabels[item.unit]}
                          {isBelowThreshold(item.quantity, item.threshold) ? (
                            <span className="medicine-low-label">Low stock</span>
                          ) : null}
                        </small>
                      </li>
                    ))}
                    {bucket.items.length === 0 ? (
                      <li className="person-empty">No medicines added yet.</li>
                    ) : null}
                  </ul>
                </article>
              ))}
            </div>
          </section>
          <footer className="page-footer">
            <Icon name="home" />
            Home Stock Manager<span>Good things, kept in order.</span>
          </footer>
        </div>
      </main>

      <dialog className="create-dialog" ref={createDialog} aria-labelledby="create-title">
        <div className="dialog-heading">
          <div>
            <span className="dialog-icon">
              <Icon name="plus" />
            </span>
            <h2 id="create-title">A new home essential</h2>
            <p>Add it once. Keep track together.</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close add item"
            onClick={() => createDialog.current?.close()}
            disabled={isCreating}
          >
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={submitCreate} className="item-form">
          <label>
            Name
            <input
              value={form.name}
              placeholder="e.g. Olive oil"
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>

          <div className="form-row">
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value as ItemCategory }))
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
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
                    {unitLabels[unit]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row">
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
              Minimum stock
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.threshold}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, threshold: Number(e.target.value) }))
                }
              />
            </label>
          </div>
          <p className="field-hint">Below this minimum? We&apos;ll add it to your shopping list.</p>

          {form.category === 'MEDICINE' ? (
            <label>
              For whom
              <select
                value={form.medicineFor}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, medicineFor: e.target.value as MedicineFor }))
                }
              >
                {medicineGroups.map((group) => (
                  <option key={group} value={group}>
                    {personLabels[group]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Notes <span className="optional-label">optional</span>
            <textarea
              placeholder="A brand, a reminder, or where you keep it..."
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>

          {createError ? (
            <p className="notice error" role="alert">
              {createError}
            </p>
          ) : null}
          <div className="dialog-footer">
            <button
              className="secondary-button"
              type="button"
              onClick={() => createDialog.current?.close()}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isCreating}>
              <Icon name="plus" />
              {isCreating ? 'Adding item...' : 'Add item'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

export default App
