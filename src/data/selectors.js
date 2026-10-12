// Read-only views over state. Current stock is ALWAYS derived from the ledger,
// never stored, so every number can be traced to the transactions behind it.

const key = (productId, locationId) => productId + '|' + locationId

export function computeBalances(ledger) {
  const byLoc = new Map() // "pid|lid" -> qty
  const byProduct = new Map() // pid -> qty
  for (const e of ledger) {
    const k = key(e.productId, e.locationId)
    byLoc.set(k, (byLoc.get(k) || 0) + e.qty)
    byProduct.set(e.productId, (byProduct.get(e.productId) || 0) + e.qty)
  }
  return { byLoc, byProduct }
}

export function balanceAt(ledger, productId, locationId) {
  let q = 0
  for (const e of ledger) if (e.productId === productId && e.locationId === locationId) q += e.qty
  return q
}

export const OPEN_PO = ['Ordered', 'Partially Received']

export function computeIncoming(purchaseOrders) {
  const m = new Map()
  for (const po of purchaseOrders) {
    if (!OPEN_PO.includes(po.status)) continue
    for (const l of po.lines) {
      const rem = Math.max(0, l.qty - l.received)
      if (rem) m.set(l.productId, (m.get(l.productId) || 0) + rem)
    }
  }
  return m
}

export function stockStatus(product, onHand) {
  if (onHand <= 0) return 'out'
  if (product.reorderLevel != null && product.reorderLevel !== '' && onHand <= Number(product.reorderLevel)) return 'low'
  return 'ok'
}

// Simple replenishment suggestion: fill up to max stock (or 2× reorder level), minus what is on hand and on order.
export function suggestedQty(product, onHand, incoming) {
  const target = Number(product.maxStock) || Math.max(Number(product.reorderLevel || 0) * 2, 1)
  return Math.max(0, Math.ceil(target - onHand - incoming))
}

export function indexBy(list) {
  const m = {}
  for (const x of list) m[x.id] = x
  return m
}

export function locationLabel(state, locationId) {
  const loc = state.locations.find((l) => l.id === locationId)
  if (!loc) return '—'
  const wh = state.warehouses.find((w) => w.id === loc.warehouseId)
  return (wh ? wh.name : '?') + ' · ' + loc.name
}

export function poTotal(po) {
  return po.lines.reduce((s, l) => s + l.qty * (Number(l.unitPrice) || 0), 0)
}

export function setupProgress(state) {
  const steps = [
    { id: 'users', label: 'Create users and assign roles', done: state.users.length > 1, to: '/users' },
    { id: 'categories', label: 'Create categories', done: state.categories.length > 0, to: '/categories' },
    { id: 'locations', label: 'Create warehouses and locations', done: state.locations.length > 0, to: '/locations' },
    { id: 'products', label: 'Create products', done: state.products.length > 0, to: '/products' },
    { id: 'suppliers', label: 'Create suppliers', done: state.suppliers.length > 0, to: '/suppliers' },
    { id: 'opening', label: 'Enter opening stock', done: state.ledger.some((e) => e.type === 'opening' || e.type === 'receipt'), to: '/opening-stock' },
  ]
  return { steps, done: steps.filter((s) => s.done).length, ready: steps.every((s) => s.done) }
}
