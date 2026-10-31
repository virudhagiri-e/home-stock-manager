import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  adjustStock,
  createItem,
  deleteItem,
  listItems,
  login,
  lookupBarcode,
  medicinePeople,
  shoppingList,
  updateItem,
} from './api'
import './App.css'
import type {
  BarcodeLookup,
  ItemCategory,
  MedicineFor,
  ShoppingItem,
  StockItem,
  Unit,
  User,
} from './types'
import { getStockStatus, type StockStatus } from './utils/stock.js'

// The barcode engine is about 1 MB, so it only loads when someone opens the scanner.
const Scanner = lazy(() => import('./Scanner'))

const categories: ItemCategory[] = ['GROCERY', 'MEDICINE', 'HOUSEHOLD', 'OTHER']
// Units that make sense per category; the first one is the default when that category is chosen.
const categoryUnits: Record<ItemCategory, Unit[]> = {
  GROCERY: ['KILOGRAM', 'GRAM', 'LITER', 'MILLILITER', 'PACKET', 'BOTTLE', 'COUNT'],
  MEDICINE: ['STRIP', 'TABLET', 'BOTTLE', 'PACKET'],
  HOUSEHOLD: ['COUNT', 'PACKET', 'BOTTLE', 'LITER', 'KILOGRAM'],
  OTHER: [
    'COUNT',
    'PACKET',
    'BOTTLE',
    'KILOGRAM',
    'GRAM',
    'LITER',
    'MILLILITER',
    'TABLET',
    'STRIP',
  ],
}
const namePlaceholders: Record<ItemCategory, string> = {
  GROCERY: 'e.g. Basmati rice',
  MEDICINE: 'e.g. Paracetamol 500 mg',
  HOUSEHOLD: 'e.g. Dishwasher tablets',
  OTHER: 'e.g. AA batteries',
}
const medicineGroups: MedicineFor[] = ['FAMILY', 'WIFE', 'CHILD', 'ME']
type QuickActionMode = 'REDUCE' | 'ADD' | 'THRESHOLD'
type QuickActionPlace = 'inventory' | 'shopping' | 'medicines'
type StockFilter = 'ALL' | 'LOW' | 'OUT'
type Notice = { kind: 'success' | 'error'; text: string } | null

const categoryLabels: Record<ItemCategory, string> = {
  GROCERY: 'Groceries',
  MEDICINE: 'Medicines',
  HOUSEHOLD: 'Household',
  OTHER: 'Other',
}
const categoryHints: Record<ItemCategory, string> = {
  GROCERY: 'Pantry and kitchen',
  MEDICINE: 'Family medicines',
  HOUSEHOLD: 'Home supplies',
  OTHER: 'Everything else',
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
// Short unit labels sit beside the number in one-line rows; long ones (tablets…) go underneath.
const shortUnits = new Set<Unit>(['COUNT', 'GRAM', 'KILOGRAM', 'MILLILITER', 'LITER'])
// How much the Bought/Used arrows change at a time, and the amount they start at.
const unitStep = (unit: Unit) => (unit === 'GRAM' || unit === 'MILLILITER' ? 50 : 1)
const unitStartAmount = (unit: Unit) => (unit === 'GRAM' || unit === 'MILLILITER' ? 100 : 1)
const unitNames: Record<Unit, string> = {
  KILOGRAM: 'kg',
  GRAM: 'g',
  LITER: 'litres',
  MILLILITER: 'ml',
  COUNT: 'pieces',
  PACKET: 'packets',
  BOTTLE: 'bottles',
  TABLET: 'tablets',
  STRIP: 'strips',
}
// Real names come from the API after sign-in (MEDICINE_PEOPLE), so they never ship in the public bundle.
const defaultPersonLabels: Record<MedicineFor, string> = {
  ME: 'Me',
  WIFE: 'Partner',
  CHILD: 'Child',
  FAMILY: 'Family',
}
const statusLabels: Record<StockStatus, string> = {
  OUT: 'Out of stock',
  LOW: 'Running low',
  OK: 'In stock',
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
  scan: 'M4 7V5a1 1 0 0 1 1-1h2m10 0h2a1 1 0 0 1 1 1v2m0 10v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8m3-8v8m3-8v8m3-8v8',
  share: 'M12 3v12m-4-8 4-4 4 4M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8',
  print: 'M7 9V3h10v6M7 18H4v-8h16v8h-3M7 14h10v7H7z',
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
      strokeWidth="2"
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
        Home Stock<span className="brand-caption">Your family&apos;s shared stock</span>
      </span>
    </div>
  )
}

function PantryIllustration() {
  return (
    <svg className="pantry-illustration" viewBox="0 0 440 280" fill="none" aria-hidden="true">
      <rect x="36" y="34" width="368" height="226" rx="100" fill="#FFFFFF" fillOpacity="0.55" />
      <path d="M56 157h328M56 249h328" stroke="#3B5BDB" strokeWidth="6" strokeLinecap="round" />
      <rect x="77" y="76" width="57" height="78" rx="12" fill="#FFFFFF" />
      <rect x="80" y="68" width="51" height="13" rx="4" fill="#D6336C" />
      <path d="M85 113c12-12 29 10 41-4v35H85v-31Z" fill="#FFB020" />
      <rect x="151" y="93" width="76" height="61" rx="10" fill="#2B9348" />
      <path d="M160 92v-9h58v9" fill="#1F6E35" />
      <rect x="173" y="108" width="32" height="29" rx="6" fill="#FFFFFF" />
      <path d="M181 123h16m-8-8v16" stroke="#2B9348" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M264 154V92c-18-15-16-32-7-43 15 10 21 24 7 43Zm0-42c5-25 19-30 34-28-1 19-12 30-34 28Zm0-18c-24-2-32-14-31-30 18-1 30 10 31 30Z"
        fill="#2B9348"
      />
      <path d="M243 123h44l-5 31h-34l-5-31Z" fill="#F08C00" />
      <rect x="314" y="97" width="44" height="57" rx="8" fill="#0C8599" />
      <rect x="318" y="90" width="36" height="10" rx="3" fill="#086170" />
      <path d="M325 119h22m-22 8h15" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      <path d="M80 185h91v61H80z" fill="#748FFC" />
      <path d="M76 177h99v14H76z" fill="#3B5BDB" />
      <rect x="108" y="203" width="35" height="18" rx="5" fill="#FFFFFF" />
      <rect x="193" y="183" width="48" height="63" rx="10" fill="#FFFFFF" />
      <rect x="197" y="175" width="40" height="12" rx="4" fill="#D6336C" />
      <path d="M201 224h32v14h-32z" fill="#FFD8E6" />
      <rect x="267" y="190" width="84" height="56" rx="11" fill="#FFB020" />
      <path d="M267 205h84m-57-15v56m29-56v56" stroke="#F08C00" strokeWidth="2" />
      <path d="m348 49 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1 4-8Z" fill="#FFB020" />
    </svg>
  )
}

// Radio buttons styled as tappable chips, used instead of native dropdowns for short lists.
function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  labelFor,
  toneFor,
  onChange,
}: {
  legend: string
  name: string
  options: readonly T[]
  value: T
  labelFor: (option: T) => string
  toneFor?: (option: T) => string
  onChange: (option: T) => void
}) {
  return (
    <fieldset className="choice-group">
      <legend>{legend}</legend>
      <div className="choice-options">
        {options.map((option) => (
          <label key={option} className={`choice ${toneFor?.(option) ?? 'tone-all'}`}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{labelFor(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// Number box for amounts: empty (not "0") when nothing is entered, and the arrows step by whole numbers.
function AmountInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(value === 0 ? '' : String(value))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    if (Number(text || 0) !== value) setText(value === 0 ? '' : String(value))
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step="any"
      placeholder="0"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange(e.target.value === '' ? 0 : Number(e.target.value))
      }}
    />
  )
}

function unitFor(value: number, unit: Unit) {
  const label = unitLabels[unit]
  return value === 1 && label.endsWith('s') && label !== 'pcs' ? label.slice(0, -1) : label
}

function formatAmount(value: number, unit: Unit) {
  return `${value} ${unitFor(value, unit)}`
}

function shortDate() {
  return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const sections = ['inventory', 'shopping', 'medicines'] as const
type Section = (typeof sections)[number]

// Phones show one section at a time, so unknown hashes must fall back to a real section.
function sectionFromHash(): Section {
  const hash = window.location.hash.slice(1)
  return (sections as readonly string[]).includes(hash) ? (hash as Section) : 'inventory'
}

// Phones get a different inventory layout, so the component needs to know the screen size.
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}
const emptyForm = {
  name: '',
  category: 'GROCERY' as ItemCategory,
  unit: 'KILOGRAM' as Unit,
  quantity: 0,
  threshold: 0,
  notes: '',
  medicineFor: 'FAMILY' as MedicineFor,
  barcode: null as string | null,
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
  const [loginError, setLoginError] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [filter, setFilter] = useState<ItemCategory | 'ALL'>('ALL')
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL')
  const [search, setSearch] = useState('')
  const [medicineSearch, setMedicineSearch] = useState('')
  const [personLabels, setPersonLabels] = useState(defaultPersonLabels)
  // The Medicines tab adds medicines only; the inventory adds everything else.
  const [createMode, setCreateMode] = useState<'inventory' | 'medicine'>('inventory')
  const [activeSection, setActiveSection] = useState(sectionFromHash)
  const [isLoading, setIsLoading] = useState(Boolean(token))
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [editingItem, setEditingItem] = useState<StockItem | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanInfo, setScanInfo] = useState<Pick<BarcodeLookup, 'source' | 'matches'> | null>(null)
  const createDialog = useRef<HTMLDialogElement>(null)
  const confirmDialog = useRef<HTMLDialogElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ item: StockItem; fromEdit: boolean } | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (deleteTarget && !confirmDialog.current?.open) confirmDialog.current?.showModal()
  }, [deleteTarget])
  const quickActionInput = useRef<HTMLInputElement>(null)
  const isPhone = useMediaQuery('(max-width: 700px)')
  const [form, setForm] = useState(emptyForm)
  const [quickActionItem, setQuickActionItem] = useState<StockItem | null>(null)
  const [quickActionMode, setQuickActionMode] = useState<QuickActionMode | null>(null)
  // Where the amount box is shown, so it opens under the row that was tapped.
  const [quickActionPlace, setQuickActionPlace] = useState<QuickActionPlace>('inventory')
  const [quickActionValue, setQuickActionValue] = useState('1')
  const [isQuickActionSaving, setIsQuickActionSaving] = useState(false)
  const [quickActionError, setQuickActionError] = useState('')

  useEffect(() => {
    const updateSection = () => setActiveSection(sectionFromHash())
    window.addEventListener('hashchange', updateSection)
    return () => window.removeEventListener('hashchange', updateSection)
  }, [])

  useEffect(() => {
    const input = quickActionInput.current
    if (!input) return
    // Centre the editor so it isn't hidden behind the phone tab bar.
    input.focus({ preventScroll: true })
    input.select()
    input.closest('.quick-action')?.scrollIntoView({ block: 'center' })
  }, [quickActionItem?.id, quickActionMode, quickActionPlace])

  useEffect(() => {
    if (notice?.kind !== 'success') return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function loadData(currentToken: string) {
    const [allItems, shopping, people] = await Promise.all([
      listItems(currentToken),
      shoppingList(currentToken),
      medicinePeople(currentToken).catch(() => null),
    ])
    setItems(allItems)
    setShop(shopping)
    if (people) setPersonLabels({ ...defaultPersonLabels, ...people })
  }

  function parseNumericInput(value: string) {
    return Number(value.trim().replace(',', '.'))
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError('')
    setNotice(null)
    setIsSigningIn(true)

    try {
      const res = await login(email, password)
      localStorage.setItem('hsm-token', res.token)
      localStorage.setItem('hsm-user', JSON.stringify(res.user))
      setToken(res.token)
      setUser(res.user)
      await loadData(res.token)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
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
    setNotice(null)
  }

  useEffect(() => {
    if (!token) {
      return
    }

    setIsLoading(true)
    loadData(token)
      .catch((err: unknown) => {
        logout()
        setLoginError(
          err instanceof Error && !/unauthori[sz]ed|token/i.test(err.message)
            ? err.message
            : 'Your sign-in has expired. Please sign in again.',
        )
      })
      .finally(() => setIsLoading(false))
  }, [token])

  // Medicines have their own tab, so the inventory covers everything else.
  const inventoryItems = useMemo(
    () => items.filter((item) => item.category !== 'MEDICINE'),
    [items],
  )

  const statusCounts = useMemo(() => {
    const counts: Record<StockStatus, number> = { OUT: 0, LOW: 0, OK: 0 }
    for (const item of inventoryItems) counts[getStockStatus(item.quantity, item.threshold)] += 1
    return counts
  }, [inventoryItems])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    // Phones hide the stock filters (the Shopping list tab covers them), so ignore them there.
    const activeStockFilter = isPhone ? 'ALL' : stockFilter
    return inventoryItems.filter(
      (item) =>
        (filter === 'ALL' || item.category === filter) &&
        (activeStockFilter === 'ALL' ||
          getStockStatus(item.quantity, item.threshold) === activeStockFilter) &&
        `${item.name} ${item.notes ?? ''}`.toLowerCase().includes(query),
    )
  }, [inventoryItems, filter, search, stockFilter, isPhone])

  const categoryCount = (category: ItemCategory) =>
    items.filter((item) => item.category === category).length

  const medicineBuckets = useMemo(() => {
    const query = medicineSearch.trim().toLowerCase()
    return medicineGroups.map((group) => ({
      group,
      items: items.filter(
        (item) =>
          item.category === 'MEDICINE' &&
          item.medicineFor === group &&
          `${item.name} ${item.notes ?? ''}`.toLowerCase().includes(query),
      ),
    }))
  }, [items, medicineSearch])

  const shoppingGroups = categories
    .map((category) => ({ category, list: shop.filter((item) => item.category === category) }))
    .filter((group) => group.list.length > 0)
  const outOfStockToBuy = shop.filter((item) => item.outOfStock).length
  const unitOptions = categoryUnits[form.category].includes(form.unit)
    ? categoryUnits[form.category]
    : [form.unit, ...categoryUnits[form.category]]

  function showItems(category: ItemCategory | 'ALL') {
    setFilter(category)
    setStockFilter('ALL')
    setSearch('')
  }

  // Plain text that reads well in Notes, WhatsApp, Messages or e-mail; one category or all.
  function shoppingListText(category?: ItemCategory) {
    const date = shortDate()
    const groups = category
      ? shoppingGroups.filter((group) => group.category === category)
      : shoppingGroups
    const lines = [
      category ? `🛒 ${categoryLabels[category]} to buy – ${date}` : `🛒 Shopping list – ${date}`,
    ]
    for (const group of groups) {
      lines.push('')
      if (!category) lines.push(categoryLabels[group.category])
      for (const entry of group.list) {
        const amount = entry.missingBy > 0 ? formatAmount(entry.missingBy, entry.unit) : 'more'
        const notes = [
          entry.category === 'MEDICINE' && entry.medicineFor
            ? `for ${personLabels[entry.medicineFor]}`
            : '',
          entry.outOfStock ? 'out of stock' : '',
        ].filter(Boolean)
        lines.push(`☐ ${entry.name} – ${amount}${notes.length ? ` (${notes.join(', ')})` : ''}`)
      }
    }
    return lines.join('\n')
  }

  function shareShoppingList(category?: ItemCategory) {
    return shareText(
      category ? `${categoryLabels[category]} list` : 'Shopping list',
      shoppingListText(category),
    )
  }

  // "Have" line for a stock item, flagging anything that needs buying.
  function stockLine(item: StockItem) {
    const status = getStockStatus(item.quantity, item.threshold)
    const flag = status === 'OK' ? '' : ` (${statusLabels[status].toLowerCase()})`
    return `• ${item.name} – ${formatAmount(item.quantity, item.unit)}${flag}`
  }

  // Shares what is currently shown in the inventory, so a search or filter narrows it.
  function shareInventory() {
    const lines = [`🏠 Home stock – ${shortDate()}`]
    for (const category of categories) {
      const list = filteredItems.filter((item) => item.category === category)
      if (list.length === 0) continue
      lines.push('', categoryLabels[category], ...list.map(stockLine))
    }
    return shareText('Home stock', lines.join('\n'))
  }

  function shareMedicines(group?: MedicineFor) {
    const buckets = medicineBuckets.filter(
      (bucket) => bucket.items.length > 0 && (!group || bucket.group === group),
    )
    const title = group ? `Medicines for ${personLabels[group]}` : 'Medicines'
    const lines = [`💊 ${title} – ${shortDate()}`]
    for (const bucket of buckets) {
      lines.push('')
      if (!group) lines.push(personLabels[bucket.group])
      lines.push(...bucket.items.map(stockLine))
    }
    return shareText(title, lines.join('\n'))
  }

  // Prints one section only; the print stylesheet reads data-print on <html>.
  function printSection(section: 'inventory' | 'medicines' | 'shopping') {
    const root = document.documentElement
    root.dataset.print = section
    window.addEventListener('afterprint', () => delete root.dataset.print, { once: true })
    window.print()
  }

  // Phone share sheet where available; otherwise copy to the clipboard.
  async function shareText(what: string, text: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title: what, text })
        return
      } catch (err) {
        // Closing the share sheet is not an error; anything else falls back to copying.
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setNotice({ kind: 'success', text: `${what} copied. Paste it into Notes or a chat.` })
    } catch {
      setNotice({ kind: 'error', text: `Could not share or copy the ${what.toLowerCase()}.` })
    }
  }

  function resetFilters() {
    showItems('ALL')
  }

  // From the Medicines tab the form starts as a medicine; from the inventory it never does.
  function showCreateDialog(preset?: ItemCategory) {
    const base = editingItem || form.barcode ? emptyForm : form
    const category = preset ?? (base.category === 'MEDICINE' ? 'GROCERY' : base.category)
    if (base !== form) setEditingItem(null)
    setCreateMode(category === 'MEDICINE' ? 'medicine' : 'inventory')
    setForm(
      category === base.category ? base : { ...base, category, unit: categoryUnits[category][0] },
    )
    setScanInfo(null)
    setCreateError('')
    createDialog.current?.showModal()
  }

  function openScanner() {
    createDialog.current?.close()
    setScanError('')
    setScannerOpen(true)
  }

  // Opens the Bought box for an item, making sure its row is visible first.
  function showBoughtFor(item: StockItem) {
    if (item.category === 'MEDICINE') {
      setMedicineSearch(item.name)
      if (window.location.hash !== '#medicines') window.location.hash = '#medicines'
      openQuickAction(item, 'ADD', 'medicines')
      return
    }
    setFilter('ALL')
    setStockFilter('ALL')
    setSearch(item.name)
    if (window.location.hash !== '#inventory') window.location.hash = '#inventory'
    openQuickAction(item, 'ADD')
  }

  async function handleDetected(code: string) {
    if (!token) return
    setScanBusy(true)
    setScanError('')
    try {
      const result = await lookupBarcode(token, code)
      setScannerOpen(false)

      if (result.item) {
        showBoughtFor(result.item)
        setNotice({ kind: 'success', text: `Found ${result.item.name}. How much did you buy?` })
        return
      }

      const category = result.product?.category ?? 'GROCERY'
      setEditingItem(null)
      setCreateMode(category === 'MEDICINE' ? 'medicine' : 'inventory')
      setForm({
        ...emptyForm,
        name: result.product?.name ?? '',
        category,
        unit: result.product?.unit ?? categoryUnits[category][0],
        quantity: result.product?.quantity ?? 0,
        notes: result.product?.brand ? `Brand: ${result.product.brand}` : '',
        barcode: result.barcode,
      })
      setScanInfo({ source: result.source, matches: result.matches })
      setCreateError('')
      createDialog.current?.showModal()
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not look up this barcode.')
    } finally {
      setScanBusy(false)
    }
  }

  async function linkBarcodeTo(item: StockItem) {
    if (!token || !form.barcode || isCreating) return
    setIsCreating(true)
    setCreateError('')
    try {
      const updated = await updateItem(token, item.id, { barcode: form.barcode })
      createDialog.current?.close()
      setForm(emptyForm)
      setScanInfo(null)
      await loadData(token)
      showBoughtFor(updated)
      setNotice({
        kind: 'success',
        text: `Barcode linked to ${updated.name}. Next time it scans instantly.`,
      })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not link the barcode.')
    } finally {
      setIsCreating(false)
    }
  }

  function showEditDialog(item: StockItem) {
    closeQuickAction()
    setEditingItem(item)
    setScanInfo(null)
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      threshold: item.threshold,
      notes: item.notes ?? '',
      medicineFor: item.medicineFor ?? 'FAMILY',
      barcode: item.barcode ?? null,
    })
    setCreateError('')
    createDialog.current?.showModal()
  }

  function changeCategory(category: ItemCategory) {
    setForm((prev) => ({
      ...prev,
      category,
      // Switching back to an edited item's own category restores its saved unit.
      unit: editingItem?.category === category ? editingItem.unit : categoryUnits[category][0],
    }))
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault()
    if (!token || isCreating) return

    setNotice(null)
    setCreateError('')
    setIsCreating(true)

    try {
      const medicineFor = form.category === 'MEDICINE' ? form.medicineFor : undefined
      if (editingItem) {
        await updateItem(token, editingItem.id, {
          name: form.name,
          category: form.category,
          unit: form.unit,
          threshold: form.threshold,
          notes: form.notes,
          medicineFor,
          barcode: form.barcode,
        })
        setNotice({ kind: 'success', text: `Saved changes to ${form.name}.` })
      } else {
        await createItem(token, { ...form, medicineFor })
        setNotice({
          kind: 'success',
          text:
            form.quantity <= 0
              ? `${form.name} added. It's out of stock, so it's on your shopping list.`
              : `${form.name} added.`,
        })
      }

      setEditingItem(null)
      setForm(emptyForm)
      setScanInfo(null)
      await loadData(token)
      createDialog.current?.close()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to save. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  function openQuickAction(
    item: StockItem,
    mode: QuickActionMode,
    place: QuickActionPlace = 'inventory',
    initialValue?: number,
  ) {
    setNotice(null)
    setQuickActionError('')
    setQuickActionItem(item)
    setQuickActionMode(mode)
    setQuickActionPlace(place)
    const start =
      mode === 'REDUCE' && item.quantity > 0
        ? Math.min(unitStartAmount(item.unit), item.quantity)
        : unitStartAmount(item.unit)
    setQuickActionValue(
      mode === 'THRESHOLD' ? String(item.threshold) : String(initialValue ?? start),
    )
  }

  function closeQuickAction() {
    setQuickActionItem(null)
    setQuickActionMode(null)
    setQuickActionValue('1')
    setQuickActionError('')
    setIsQuickActionSaving(false)
  }

  async function applyQuickAction() {
    if (!token || !quickActionItem || !quickActionMode || isQuickActionSaving) return

    const item = quickActionItem
    const value = parseNumericInput(quickActionValue)
    if (Number.isNaN(value) || value < 0 || (quickActionMode !== 'THRESHOLD' && value === 0)) {
      setQuickActionError(
        quickActionMode === 'THRESHOLD'
          ? 'Enter a minimum of 0 or more.'
          : 'Enter an amount greater than 0.',
      )
      return
    }
    if (quickActionMode === 'REDUCE' && value > item.quantity) {
      setQuickActionError(
        `You only have ${formatAmount(item.quantity, item.unit)}. Enter ${item.quantity} or less.`,
      )
      return
    }

    setQuickActionError('')
    setIsQuickActionSaving(true)

    try {
      let updatedItem: StockItem
      if (quickActionMode === 'THRESHOLD') {
        updatedItem = await updateItem(token, item.id, { threshold: value })
      } else {
        const delta = quickActionMode === 'REDUCE' ? -value : value
        updatedItem = await adjustStock(
          token,
          item.id,
          delta,
          quickActionMode === 'REDUCE' ? 'Used' : 'Bought',
        )
      }

      setItems((prev) => prev.map((entry) => (entry.id === updatedItem.id ? updatedItem : entry)))
      await loadData(token)
      closeQuickAction()
      setNotice({
        kind: 'success',
        text:
          quickActionMode === 'THRESHOLD'
            ? `Minimum for ${updatedItem.name} is now ${formatAmount(updatedItem.threshold, updatedItem.unit)}.`
            : `${updatedItem.name}: you now have ${formatAmount(updatedItem.quantity, updatedItem.unit)}.`,
      })
    } catch (err) {
      setQuickActionError(err instanceof Error ? err.message : 'Unable to save. Please try again.')
      setIsQuickActionSaving(false)
    }
  }

  function remove(item: StockItem, fromEdit = false) {
    if (!token || user?.role !== 'ADMIN') return
    setDeleteTarget({ item, fromEdit })
  }

  async function confirmRemove() {
    if (!token || !deleteTarget || isDeleting) return
    const { item, fromEdit } = deleteTarget
    setIsDeleting(true)
    try {
      await deleteItem(token, item.id)
      if (quickActionItem?.id === item.id) closeQuickAction()
      confirmDialog.current?.close()
      if (fromEdit) {
        createDialog.current?.close()
        setEditingItem(null)
        setForm(emptyForm)
      }
      await loadData(token)
      setNotice({ kind: 'success', text: `${item.name} deleted.` })
    } catch (err) {
      confirmDialog.current?.close()
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Unable to delete item',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // One slim row: tap the name to edit, − / + for Used / Bought, amount box underneath.
  function compactRows(item: StockItem, place: QuickActionPlace) {
    const status = getStockStatus(item.quantity, item.threshold)
    const isOpen =
      quickActionPlace === place && quickActionItem?.id === item.id && quickActionMode !== null
    const rows = [
      <li
        key={item.id}
        className={`compact-row status-${status.toLowerCase()}${isOpen ? ' is-editing' : ''}`}
      >
        <button
          type="button"
          className="compact-main"
          onClick={() => showEditDialog(item)}
          aria-label={`${item.name}, ${formatAmount(item.quantity, item.unit)}${
            status === 'OK' ? '' : `, ${statusLabels[status].toLowerCase()}`
          }. Edit`}
        >
          <span className="compact-name">{item.name}</span>
          <span className={`compact-quantity${shortUnits.has(item.unit) ? ' inline-unit' : ''}`}>
            {item.quantity}
            <small>{unitFor(item.quantity, item.unit)}</small>
          </span>
        </button>
        <button
          type="button"
          className="compact-step step-used"
          onClick={() => openQuickAction(item, 'REDUCE', place)}
          disabled={isQuickActionSaving || item.quantity <= 0}
          aria-label="Used"
          title={`Record that you used some ${item.name}`}
        >
          <Icon name="minus" />
        </button>
        <button
          type="button"
          className="compact-step step-bought"
          onClick={() => openQuickAction(item, 'ADD', place)}
          disabled={isQuickActionSaving}
          aria-label="Bought"
          title={`Record that you bought more ${item.name}`}
        >
          <Icon name="plus" />
        </button>
      </li>,
    ]
    if (isOpen) {
      rows.push(
        <li key={`${item.id}-action`} className="compact-action">
          {quickActionEditor}
        </li>,
      )
    }
    return rows
  }

  const quickActionEditor =
    quickActionItem && quickActionMode ? (
      <div
        className={`quick-action mode-${quickActionMode.toLowerCase()}`}
        role="group"
        aria-label="Quick action"
      >
        <label className="quick-action-field">
          <span className="quick-action-title">
            {quickActionMode === 'ADD'
              ? 'How much did you buy?'
              : quickActionMode === 'REDUCE'
                ? 'How much did you use?'
                : 'Keep at least this much at home'}
          </span>
          <span className="quick-action-input">
            <input
              ref={quickActionInput}
              type="number"
              inputMode="decimal"
              min="0"
              step={unitStep(quickActionItem.unit)}
              value={quickActionValue}
              onChange={(e) => setQuickActionValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void applyQuickAction()
                }
                if (e.key === 'Escape') closeQuickAction()
              }}
              required
            />
            <span className="unit-suffix">{unitLabels[quickActionItem.unit]}</span>
          </span>
        </label>
        <div className="quick-action-buttons">
          <button
            className="primary-button"
            type="button"
            onClick={() => void applyQuickAction()}
            disabled={isQuickActionSaving}
          >
            {isQuickActionSaving ? 'Saving...' : 'Save'}
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
        <p className="quick-action-context">
          You have {formatAmount(quickActionItem.quantity, quickActionItem.unit)}. Minimum is{' '}
          {formatAmount(quickActionItem.threshold, quickActionItem.unit)}.
        </p>
        {quickActionError ? (
          <p className="quick-action-error" role="alert">
            {quickActionError}
          </p>
        ) : null}
      </div>
    ) : null

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-story" aria-label="About Home Stock">
          <Brand />
          <div className="auth-story-content">
            <PantryIllustration />
            <h1>
              Know what&apos;s at home.
              <br />
              Buy only what&apos;s missing.
            </h1>
            <p>
              Groceries, medicines and household supplies in one shared list, with a shopping list
              that fills itself.
            </p>
            <div className="auth-features">
              <span className="tone-grocery">
                <Icon name="grocery" /> Groceries
              </span>
              <span className="tone-medicine">
                <Icon name="medicine" /> Medicines
              </span>
              <span className="tone-household">
                <Icon name="household" /> Household
              </span>
            </div>
          </div>
        </section>
        <section className="auth-form-panel">
          <div className="auth-card">
            <h2>Welcome home.</h2>
            <p>Sign in to your family&apos;s shared stock.</p>
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
              {loginError ? (
                <p className="notice error" role="alert">
                  {loginError}
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
          </div>
        </section>
      </main>
    )
  }

  const summaryCards: {
    key: ItemCategory | 'ALL'
    label: string
    hint: string
    count: number
    href: string
  }[] = [
    {
      key: 'ALL',
      label: 'Inventory',
      hint: 'Groceries and household',
      count: inventoryItems.length,
      href: '#inventory',
    },
    ...(['GROCERY', 'MEDICINE', 'HOUSEHOLD'] as const).map((category) => ({
      key: category,
      label: categoryLabels[category],
      hint: categoryHints[category],
      count: categoryCount(category),
      href: category === 'MEDICINE' ? '#medicines' : '#inventory',
    })),
  ]

  return (
    <div className="app-shell">
      <a className="skip-link" href="#inventory">
        Skip to inventory
      </a>
      <aside className="sidebar">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          <a
            className="nav-link"
            href="#inventory"
            aria-current={activeSection === 'inventory' ? 'location' : undefined}
          >
            <Icon name="inventory" />
            Inventory<span className="nav-count">{inventoryItems.length}</span>
          </a>
          <a
            className="nav-link"
            href="#medicines"
            aria-current={activeSection === 'medicines' ? 'location' : undefined}
          >
            <Icon name="medicine" />
            Medicines
          </a>
          <a
            className="nav-link"
            href="#shopping"
            aria-current={activeSection === 'shopping' ? 'location' : undefined}
          >
            <Icon name="basket" />
            Shopping list
            {shop.length > 0 ? (
              <span className="nav-count nav-count-alert">{shop.length}</span>
            ) : null}
          </a>
        </nav>
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
        <div className="page-content" data-view={activeSection}>
          <section className="page-heading" aria-labelledby="page-title">
            <div>
              <h1 id="page-title">
                Hi {user?.name.split(' ')[0] ?? 'there'}, here&apos;s your home stock
              </h1>
              <p>
                Tap a number to see those items. Anything at 0 or under its minimum goes on the
                shopping list.
              </p>
            </div>
            {isPhone ? null : (
              <div className="heading-actions">
                <button
                  className="secondary-button scan-button"
                  type="button"
                  onClick={openScanner}
                >
                  <Icon name="scan" />
                  Scan
                </button>
                <button className="primary-button" type="button" onClick={() => showCreateDialog()}>
                  <Icon name="plus" />
                  Add item
                </button>
              </div>
            )}
          </section>

          <section className="summary-grid" aria-label="Inventory overview">
            {summaryCards.map((card) => {
              const tone = card.key === 'ALL' ? 'all' : card.key.toLowerCase()
              const selected =
                card.key !== 'MEDICINE' && filter === card.key && stockFilter === 'ALL' && !search
              return (
                <a
                  key={card.key}
                  href={card.href}
                  className={`summary-card tone-${tone}${selected ? ' selected' : ''}`}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => {
                    if (card.key === 'MEDICINE') setMedicineSearch('')
                    else showItems(card.key)
                  }}
                >
                  <span className="summary-icon">
                    <Icon name={card.key === 'ALL' ? 'inventory' : categoryIcons[card.key]} />
                  </span>
                  <span className="summary-label">{card.label}</span>
                  <span className="summary-number">{isLoading ? '...' : card.count}</span>
                  <span className="summary-hint">{card.hint}</span>
                </a>
              )
            })}
            <a href="#shopping" className="summary-card tone-buy">
              <span className="summary-icon">
                <Icon name="basket" />
              </span>
              <span className="summary-label">To buy</span>
              <span className="summary-number">{isLoading ? '...' : shop.length}</span>
              <span className="summary-hint">
                {outOfStockToBuy} out of stock, {shop.length - outOfStockToBuy} running low
              </span>
            </a>
          </section>

          <div className="inventory-layout">
            <section
              className="inventory-panel surface"
              id="inventory"
              aria-labelledby="inventory-title"
              aria-busy={isLoading}
            >
              <div className="banner-heading tone-inventory">
                <span className="banner-heading-icon">
                  <Icon name="inventory" />
                </span>
                <div>
                  <h2 id="inventory-title">Inventory</h2>
                  <p>
                    Showing {filteredItems.length} of {inventoryItems.length} items
                  </p>
                </div>
                {filteredItems.length > 0 ? (
                  <div className="banner-actions">
                    <button
                      type="button"
                      className="banner-button"
                      aria-label="Share inventory"
                      title="Share or copy what's at home (only the items shown)"
                      onClick={() => void shareInventory()}
                    >
                      <Icon name="share" />
                    </button>
                    <button
                      type="button"
                      className="banner-button"
                      aria-label="Print inventory"
                      title="Print or save as PDF (only the items shown)"
                      onClick={() => printSection('inventory')}
                    >
                      <Icon name="print" />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="inventory-toolbar">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    aria-label="Search inventory"
                    type="search"
                    placeholder={isPhone ? 'Search' : 'Search by name or note'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                {isPhone ? (
                  <div className="toolbar-actions">
                    <button
                      className="secondary-button scan-button icon-only"
                      type="button"
                      aria-label="Scan"
                      title="Scan a barcode"
                      onClick={openScanner}
                    >
                      <Icon name="scan" />
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      aria-label="Add item"
                      onClick={() => showCreateDialog()}
                    >
                      <Icon name="plus" />
                      Add
                    </button>
                  </div>
                ) : (
                  <div className="stock-filters" role="group" aria-label="Filter by stock">
                    <button
                      type="button"
                      aria-pressed={stockFilter === 'ALL'}
                      onClick={() => setStockFilter('ALL')}
                    >
                      Any stock
                    </button>
                    <button
                      type="button"
                      className="tone-low"
                      aria-pressed={stockFilter === 'LOW'}
                      onClick={() => setStockFilter('LOW')}
                    >
                      Running low <span className="filter-count">{statusCounts.LOW}</span>
                    </button>
                    <button
                      type="button"
                      className="tone-out"
                      aria-pressed={stockFilter === 'OUT'}
                      onClick={() => setStockFilter('OUT')}
                    >
                      Out of stock <span className="filter-count">{statusCounts.OUT}</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="category-tabs" role="group" aria-label="Filter by category">
                {categories
                  .filter((category) => category !== 'MEDICINE')
                  .filter((category) => categoryCount(category) > 0 || filter === category)
                  .map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`tone-${category.toLowerCase()}`}
                      aria-pressed={filter === category}
                      title={
                        filter === category
                          ? 'Tap again to show all items'
                          : `Show only ${categoryLabels[category].toLowerCase()}`
                      }
                      onClick={() => setFilter(filter === category ? 'ALL' : category)}
                    >
                      {categoryLabels[category]}{' '}
                      <span className="filter-count">{categoryCount(category)}</span>
                    </button>
                  ))}
              </div>

              {isPhone ? (
                <ul className="compact-list" aria-label="Inventory items">
                  {filteredItems.flatMap((item) => compactRows(item, 'inventory'))}
                </ul>
              ) : (
                <div className="table-wrap" role="region" aria-label="Inventory table" tabIndex={0}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">In stock</th>
                        <th scope="col">Minimum</th>
                        <th scope="col">Update</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.flatMap((item) => {
                        const status = getStockStatus(item.quantity, item.threshold)
                        const isOpen =
                          quickActionPlace === 'inventory' &&
                          quickActionItem?.id === item.id &&
                          quickActionMode !== null
                        const rows = [
                          <tr
                            key={item.id}
                            className={`stock-row status-${status.toLowerCase()}${isOpen ? ' is-editing' : ''}`}
                          >
                            <td>
                              <div className="item-identity">
                                <span className={`item-icon tone-${item.category.toLowerCase()}`}>
                                  <Icon name={categoryIcons[item.category]} />
                                </span>
                                <div>
                                  <span className="item-name">{item.name}</span>
                                  <span className="item-meta">
                                    {categoryLabels[item.category]}
                                    {item.medicineFor
                                      ? ` for ${personLabels[item.medicineFor]}`
                                      : ''}
                                  </span>
                                  {item.notes ? (
                                    <span className="item-notes">{item.notes}</span>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => showEditDialog(item)}
                                    disabled={isQuickActionSaving}
                                    title={`Edit name, category, unit or notes for ${item.name}`}
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td data-label="In stock">
                              <span className="quantity">
                                {item.quantity}
                                <small>{unitLabels[item.unit]}</small>
                              </span>
                              <span className={`status-pill status-${status.toLowerCase()}`}>
                                {statusLabels[status]}
                              </span>
                            </td>
                            <td data-label="Minimum">
                              <span className="minimum-quantity">
                                {item.threshold} <small>{unitLabels[item.unit]}</small>
                              </span>
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => openQuickAction(item, 'THRESHOLD')}
                                disabled={isQuickActionSaving}
                                title={`Change the minimum stock for ${item.name}`}
                              >
                                Change
                              </button>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="action-button action-used"
                                  onClick={() => openQuickAction(item, 'REDUCE')}
                                  disabled={isQuickActionSaving || item.quantity <= 0}
                                  title={`Record that you used some ${item.name}`}
                                >
                                  <Icon name="minus" />
                                  Used
                                </button>
                                <button
                                  type="button"
                                  className="action-button action-bought"
                                  onClick={() => openQuickAction(item, 'ADD')}
                                  disabled={isQuickActionSaving}
                                  title={`Record that you bought more ${item.name}`}
                                >
                                  <Icon name="plus" />
                                  Bought
                                </button>
                                {user?.role === 'ADMIN' ? (
                                  <button
                                    type="button"
                                    className="action-button action-delete"
                                    onClick={() => remove(item)}
                                    disabled={isQuickActionSaving}
                                    title={`Delete ${item.name}`}
                                  >
                                    <Icon name="trash" />
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>,
                        ]

                        if (isOpen) {
                          rows.push(
                            <tr key={`${item.id}-action`} className="action-row">
                              <td colSpan={4}>{quickActionEditor}</td>
                            </tr>,
                          )
                        }
                        return rows
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {isLoading ? (
                <div className="empty-state" role="status">
                  <span className="loading-dot" />
                  <p>Getting your household ready...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="empty-state">
                  <Icon name={inventoryItems.length === 0 ? 'inventory' : 'search'} />
                  <h3>
                    {inventoryItems.length === 0
                      ? 'Make room for your essentials.'
                      : 'No matching essentials.'}
                  </h3>
                  <p>
                    {inventoryItems.length === 0
                      ? 'Add your first item to start keeping track.'
                      : 'Try a different search or reset your filters.'}
                  </p>
                  <button
                    className="secondary-button"
                    onClick={inventoryItems.length === 0 ? () => showCreateDialog() : resetFilters}
                  >
                    {inventoryItems.length === 0 ? 'Add your first item' : 'Reset filters'}
                  </button>
                </div>
              ) : null}
            </section>

            <aside className="shopping surface" id="shopping" aria-labelledby="shopping-title">
              <div className="banner-heading tone-shop">
                <span className="banner-heading-icon">
                  <Icon name="basket" />
                </span>
                <div>
                  <h2 id="shopping-title">Shopping list</h2>
                  <p>
                    {shop.length === 0
                      ? 'Nothing to buy right now'
                      : `${shop.length} ${shop.length === 1 ? 'item' : 'items'} to buy${
                          outOfStockToBuy > 0 ? `, ${outOfStockToBuy} out of stock` : ''
                        }`}
                  </p>
                </div>
                {shop.length > 0 ? (
                  <div className="banner-actions">
                    <button
                      type="button"
                      className="banner-button"
                      aria-label="Share shopping list"
                      title="Share as text (Notes, WhatsApp, Messages…)"
                      onClick={() => void shareShoppingList()}
                    >
                      <Icon name="share" />
                    </button>
                    <button
                      type="button"
                      className="banner-button"
                      aria-label="Print or save as PDF"
                      title="Print or save as PDF"
                      onClick={() => printSection('shopping')}
                    >
                      <Icon name="print" />
                    </button>
                  </div>
                ) : null}
              </div>
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
                  <p>Items appear here when they run out or drop below their minimum.</p>
                </div>
              ) : (
                shoppingGroups.map((group) => (
                  <section
                    key={group.category}
                    className={`shopping-group tone-${group.category.toLowerCase()}`}
                    aria-label={`${categoryLabels[group.category]} to buy`}
                  >
                    <div className="shopping-group-head">
                      <h3>
                        <span className="shopping-group-icon">
                          <Icon name={categoryIcons[group.category]} />
                        </span>
                        {categoryLabels[group.category]}
                        <span className="shopping-group-count">{group.list.length}</span>
                      </h3>
                      <button
                        type="button"
                        className="group-share"
                        aria-label={`Share ${categoryLabels[group.category].toLowerCase()} list`}
                        title={`Share or copy just the ${categoryLabels[group.category].toLowerCase()}`}
                        onClick={() => void shareShoppingList(group.category)}
                      >
                        <Icon name="share" />
                      </button>
                    </div>
                    <ul className="shopping-items">
                      {group.list.flatMap((entry) => {
                        const item = items.find((stock) => stock.id === entry.id)
                        if (!item) return []
                        const isOpen =
                          quickActionPlace === 'shopping' &&
                          quickActionItem?.id === item.id &&
                          quickActionMode !== null
                        const rows = [
                          <li
                            key={entry.id}
                            className={`${entry.outOfStock ? 'need-out' : 'need-low'}${isOpen ? ' is-editing' : ''}`}
                          >
                            <button
                              type="button"
                              className="shopping-main"
                              onClick={() => showEditDialog(item)}
                              title={`Edit ${entry.name}`}
                            >
                              <strong>
                                {entry.name}
                                {entry.category === 'MEDICINE' && entry.medicineFor ? (
                                  <span
                                    className={`shopping-person for-${entry.medicineFor.toLowerCase()}`}
                                  >
                                    <span className="visually-hidden">for </span>
                                    {personLabels[entry.medicineFor]}
                                  </span>
                                ) : null}
                              </strong>
                              <span className="shopping-need">
                                {entry.missingBy > 0
                                  ? `Buy ${formatAmount(entry.missingBy, entry.unit)}`
                                  : 'Buy more'}
                              </span>
                              <small>
                                Have {formatAmount(entry.quantity, entry.unit)}, minimum{' '}
                                {formatAmount(entry.threshold, entry.unit)}
                              </small>
                            </button>
                            <span className="shopping-side">
                              <span
                                className={`status-pill status-${entry.outOfStock ? 'out' : 'low'}`}
                              >
                                {entry.outOfStock ? statusLabels.OUT : statusLabels.LOW}
                              </span>
                              <button
                                type="button"
                                className="action-button action-bought"
                                disabled={isQuickActionSaving}
                                aria-label="Bought"
                                title={`Record that you bought ${entry.name}`}
                                onClick={() =>
                                  openQuickAction(
                                    item,
                                    'ADD',
                                    'shopping',
                                    entry.missingBy > 0 ? entry.missingBy : 1,
                                  )
                                }
                              >
                                <Icon name="plus" />
                                Bought
                              </button>
                            </span>
                          </li>,
                        ]
                        if (isOpen) {
                          rows.push(
                            <li key={`${entry.id}-action`} className="shopping-action">
                              {quickActionEditor}
                            </li>,
                          )
                        }
                        return rows
                      })}
                    </ul>
                  </section>
                ))
              )}
            </aside>
          </div>

          <section
            className="medicine-panel surface"
            id="medicines"
            aria-labelledby="medicine-title"
          >
            <div className="banner-heading tone-medicine">
              <span className="banner-heading-icon">
                <Icon name={categoryIcons.MEDICINE} />
              </span>
              <div>
                <h2 id="medicine-title">Medicines</h2>
                <p>{categoryCount('MEDICINE')} medicines, by person</p>
              </div>
              {categoryCount('MEDICINE') > 0 ? (
                <div className="banner-actions">
                  <button
                    type="button"
                    className="banner-button"
                    aria-label="Share medicines"
                    title="Share or copy all medicines, by person"
                    onClick={() => void shareMedicines()}
                  >
                    <Icon name="share" />
                  </button>
                  <button
                    type="button"
                    className="banner-button"
                    aria-label="Print medicines"
                    title="Print or save as PDF"
                    onClick={() => printSection('medicines')}
                  >
                    <Icon name="print" />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="inventory-toolbar medicine-toolbar">
              <label className="search-field">
                <Icon name="search" />
                <input
                  aria-label="Search medicines"
                  type="search"
                  placeholder={isPhone ? 'Search' : 'Search medicines'}
                  value={medicineSearch}
                  onChange={(e) => setMedicineSearch(e.target.value)}
                />
              </label>
              <div className="toolbar-actions">
                <button
                  className="primary-button"
                  type="button"
                  aria-label="Add medicine"
                  onClick={() => showCreateDialog('MEDICINE')}
                >
                  <Icon name="plus" />
                  Add
                </button>
              </div>
            </div>
            <div className="med-grid">
              {medicineBuckets
                .filter((bucket) => !medicineSearch.trim() || bucket.items.length > 0)
                .map((bucket) => (
                  <article
                    key={bucket.group}
                    className={`person-medicines person-card-${bucket.group.toLowerCase()}`}
                  >
                    <div className="person-head">
                      <h3>
                        <span className={`person-avatar person-${bucket.group.toLowerCase()}`}>
                          {personLabels[bucket.group].charAt(0)}
                        </span>
                        {personLabels[bucket.group]}
                        <span className="person-count">{bucket.items.length}</span>
                      </h3>
                      {bucket.items.length > 0 ? (
                        <button
                          type="button"
                          className="group-share"
                          aria-label={`Share medicines for ${personLabels[bucket.group]}`}
                          title={`Share or copy ${personLabels[bucket.group]}'s medicines`}
                          onClick={() => void shareMedicines(bucket.group)}
                        >
                          <Icon name="share" />
                        </button>
                      ) : null}
                    </div>
                    <ul className="compact-list person-list">
                      {bucket.items.flatMap((item) => compactRows(item, 'medicines'))}
                      {bucket.items.length === 0 ? (
                        <li className="person-empty">No medicines added yet.</li>
                      ) : null}
                    </ul>
                  </article>
                ))}
              {medicineSearch.trim() && medicineBuckets.every((b) => b.items.length === 0) ? (
                <p className="person-empty" role="status">
                  No medicines match &ldquo;{medicineSearch.trim()}&rdquo;.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      {scannerOpen ? (
        <Suspense fallback={null}>
          <Scanner
            busy={scanBusy}
            error={scanError}
            onDetected={(code) => void handleDetected(code)}
            onClose={() => {
              setScannerOpen(false)
              setScanError('')
            }}
          />
        </Suspense>
      ) : null}

      {notice ? (
        <div
          className={`toast toast-${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          <Icon name={notice.kind === 'error' ? 'alert' : 'check'} />
          <span>{notice.text}</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <Icon name="close" />
          </button>
        </div>
      ) : null}

      <dialog
        className="create-dialog"
        ref={createDialog}
        aria-labelledby="create-title"
        onClose={() => setCreateError('')}
      >
        <div className="dialog-heading">
          <div>
            <h2 id="create-title">
              {editingItem
                ? `Edit ${editingItem.name}`
                : createMode === 'medicine'
                  ? 'Add a medicine'
                  : 'Add an item'}
            </h2>
            <p>
              {editingItem
                ? (() => {
                    const status = getStockStatus(editingItem.quantity, editingItem.threshold)
                    return `You have ${formatAmount(editingItem.quantity, editingItem.unit)}${
                      status === 'OK' ? '' : `, ${statusLabels[status].toLowerCase()}`
                    }. To change the amount, use Used (−) or Bought (+).`
                  })()
                : 'Only the name is required. You can fill in the rest later.'}
            </p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={editingItem ? 'Close edit item' : 'Close add item'}
            onClick={() => createDialog.current?.close()}
            disabled={isCreating}
          >
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={submitCreate} className="item-form">
          {editingItem || form.barcode || createMode === 'medicine' ? null : (
            <button className="scan-inline" type="button" onClick={openScanner}>
              <Icon name="scan" />
              Have a barcode? Scan it to fill this in
            </button>
          )}
          {scanInfo ? (
            <div
              className={`scan-result ${scanInfo.source === 'none' || scanInfo.source === 'unavailable' ? 'scan-unknown' : 'scan-found'}`}
              role="status"
            >
              {scanInfo.source === 'unavailable' ? (
                <p>
                  Product lookup is unavailable right now, so details couldn&apos;t be filled in.
                  Fill them in yourself, or close this and scan again later.
                </p>
              ) : scanInfo.source === 'none' ? (
                <p>
                  We don&apos;t know this product yet. Fill it in once and it will be recognised
                  next time you scan it.
                </p>
              ) : (
                <p>
                  Filled in from{' '}
                  <a
                    href={
                      scanInfo.source === 'openproductsfacts'
                        ? 'https://world.openproductsfacts.org'
                        : 'https://world.openfoodfacts.org'
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {scanInfo.source === 'openproductsfacts'
                      ? 'Open Products Facts'
                      : 'Open Food Facts'}
                  </a>
                  . Check the details before saving.
                </p>
              )}
              {scanInfo.matches.length > 0 ? (
                <div className="scan-matches">
                  <span>Already have it?</span>
                  {scanInfo.matches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      className="secondary-button"
                      disabled={isCreating}
                      onClick={() => void linkBarcodeTo(match)}
                    >
                      This is my {match.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {form.barcode ? (
            <p className="barcode-line">
              <Icon name="scan" />
              <span>
                Barcode <strong>{form.barcode}</strong>
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => setForm((prev) => ({ ...prev, barcode: null }))}
              >
                Remove
              </button>
            </p>
          ) : null}
          <label>
            Name
            <input
              value={form.name}
              placeholder={namePlaceholders[form.category]}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>

          {!editingItem && createMode === 'medicine' ? null : (
            <ChoiceGroup
              legend="Category"
              name="category"
              options={
                editingItem ? categories : categories.filter((category) => category !== 'MEDICINE')
              }
              value={form.category}
              labelFor={(category) => categoryLabels[category]}
              toneFor={(category) => `tone-${category.toLowerCase()}`}
              onChange={changeCategory}
            />
          )}

          {form.category === 'MEDICINE' ? (
            <ChoiceGroup
              legend="For whom"
              name="medicine-for"
              options={medicineGroups}
              value={form.medicineFor}
              labelFor={(group) => personLabels[group]}
              toneFor={() => 'tone-medicine'}
              onChange={(medicineFor) => setForm((prev) => ({ ...prev, medicineFor }))}
            />
          ) : null}

          <ChoiceGroup
            legend="Unit"
            name="unit"
            options={unitOptions}
            value={form.unit}
            labelFor={(unit) => unitNames[unit]}
            onChange={(unit) => setForm((prev) => ({ ...prev, unit }))}
          />

          <div className="form-row">
            {editingItem ? null : (
              <label>
                Quantity at home
                <AmountInput
                  value={form.quantity}
                  onChange={(quantity) => setForm((prev) => ({ ...prev, quantity }))}
                />
              </label>
            )}

            <label>
              Minimum stock
              <AmountInput
                value={form.threshold}
                onChange={(threshold) => setForm((prev) => ({ ...prev, threshold }))}
              />
            </label>
          </div>
          {editingItem ? null : (
            <p className="field-hint">
              Leave the quantity at 0 if you&apos;ve run out: it goes straight onto the shopping
              list. It also goes there whenever stock drops below the minimum.
            </p>
          )}

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
            {editingItem && user?.role === 'ADMIN' ? (
              <button
                className="secondary-button dialog-delete"
                title={`Delete ${editingItem.name}`}
                type="button"
                disabled={isCreating}
                onClick={() => remove(editingItem, true)}
              >
                <Icon name="trash" />
                Delete
              </button>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              onClick={() => createDialog.current?.close()}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isCreating}>
              <Icon name={editingItem ? 'check' : 'plus'} />
              {editingItem
                ? isCreating
                  ? 'Saving...'
                  : 'Save changes'
                : isCreating
                  ? 'Adding...'
                  : createMode === 'medicine'
                    ? 'Add medicine'
                    : 'Add item'}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        className="confirm-dialog"
        ref={confirmDialog}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget ? (
          <>
            <span className="confirm-icon">
              <Icon name="trash" />
            </span>
            <h2 id="confirm-title">Delete {deleteTarget.item.name}?</h2>
            <p id="confirm-text">
              It will be removed from your stock and the shopping list. This can&apos;t be undone.
            </p>
            <div className="confirm-actions">
              <button
                className="secondary-button"
                type="button"
                autoFocus
                disabled={isDeleting}
                onClick={() => confirmDialog.current?.close()}
              >
                Keep it
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={isDeleting}
                onClick={() => void confirmRemove()}
              >
                <Icon name="trash" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  )
}

export default App
