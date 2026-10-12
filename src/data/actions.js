// All state changes go through these actions.
// Each action receives a draft copy of state (d), a payload (p) and a context ({ user, now }),
// validates the business rules from the requirements, mutates the draft, and may return a result.
// A thrown ValidationError aborts the whole action — nothing is saved.
//
// Rules enforced here (requirements §22):
//  - stock never goes negative; issues/transfers cannot exceed what is at the source
//  - receiving cannot exceed the remaining PO quantity (unless over-receiving is enabled)
//  - cancelled POs cannot receive; creating a PO never changes on-hand stock
//  - inactive products / locations cannot be used in new transactions
//  - records referenced by transactions are deactivated, never deleted
//  - every stock change writes a ledger entry; important actions write an audit entry

import { can, ISSUE_REASONS } from './constants.js'
import { balanceAt } from './selectors.js'

export class ValidationError extends Error {}
const fail = (msg) => { throw new ValidationError(msg) }

const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 10)
const trim = (s) => (s == null ? '' : String(s).trim())
const toNum = (v) => (v === '' || v == null ? null : Number(v))

function need(ctx, perm) {
  if (!can(ctx.user, perm)) fail("Your role doesn't allow this action.")
}
function positiveQty(q, what = 'Quantity') {
  const n = Number(q)
  if (!Number.isFinite(n) || n <= 0) fail(what + ' must be more than 0.')
  return n
}
function nextNumber(d, k, prefix) {
  d.counters[k] = (d.counters[k] || 0) + 1
  return prefix + '-' + String(d.counters[k]).padStart(4, '0')
}
function audit(d, ctx, action, record, extra = {}) {
  d.audit.unshift({
    id: uid('au'), at: ctx.now, userId: ctx.user.id, action, record,
    prev: extra.prev ?? null, next: extra.next ?? null, reason: extra.reason ?? null,
  })
}
function ledger(d, ctx, { productId, locationId, qty, type, reference, refId }) {
  d.ledger.push({ id: uid('le'), at: ctx.now, productId, locationId, qty, type, reference, refId, userId: ctx.user.id })
}
function product(d, id, { active = true } = {}) {
  const p = d.products.find((x) => x.id === id)
  if (!p) fail('Choose an item.')
  if (active && !p.active) fail(`${p.name} is inactive and can't be used in new transactions.`)
  return p
}
function location(d, id, { active = true } = {}) {
  const l = d.locations.find((x) => x.id === id)
  if (!l) fail('Choose a location.')
  if (active && !l.active) fail(`Location ${l.name} is inactive.`)
  const wh = d.warehouses.find((w) => w.id === l.warehouseId)
  if (active && wh && !wh.active) fail(`Warehouse ${wh.name} is inactive.`)
  return l
}
const locName = (d, id) => {
  const l = d.locations.find((x) => x.id === id)
  const w = l && d.warehouses.find((x) => x.id === l.warehouseId)
  return l ? `${w ? w.name : ''} · ${l.name}` : '?'
}

/* ---------------- Users & settings ---------------- */

export function saveUser(d, p, ctx) {
  need(ctx, 'users.manage')
  const name = trim(p.name)
  if (!name) fail('Name is required.')
  if (!p.role) fail('Choose a role.')
  if (p.id) {
    const u = d.users.find((x) => x.id === p.id)
    if (u.role === 'admin' && p.role !== 'admin' && d.users.filter((x) => x.role === 'admin' && x.active).length === 1)
      fail('Keep at least one active Admin.')
    audit(d, ctx, u.role !== p.role ? 'Role changed' : 'User updated', name, { prev: u.role, next: p.role })
    Object.assign(u, { name, role: p.role, email: trim(p.email) })
    return u.id
  }
  const u = { id: uid('u'), name, role: p.role, email: trim(p.email), active: true }
  d.users.push(u)
  audit(d, ctx, 'User created', name, { next: p.role })
  return u.id
}

export function setUserActive(d, p, ctx) {
  need(ctx, 'users.manage')
  const u = d.users.find((x) => x.id === p.id)
  if (u.id === ctx.user.id && !p.active) fail("You can't deactivate yourself.")
  if (!p.active && u.role === 'admin' && d.users.filter((x) => x.role === 'admin' && x.active).length === 1)
    fail('Keep at least one active Admin.')
  u.active = p.active
  audit(d, ctx, p.active ? 'User activated' : 'User deactivated', u.name)
}

export function saveSettings(d, p, ctx) {
  need(ctx, 'users.manage')
  const prev = JSON.stringify(d.settings)
  d.settings = { ...d.settings, ...p }
  audit(d, ctx, 'Settings changed', 'Settings', { prev, next: JSON.stringify(d.settings) })
}

/* ---------------- Categories ---------------- */

export function saveCategory(d, p, ctx) {
  need(ctx, 'master.edit')
  const name = trim(p.name)
  if (!name) fail('Category name is required.')
  if (d.categories.some((c) => c.id !== p.id && c.name.toLowerCase() === name.toLowerCase() && (c.parentId || null) === (p.parentId || null)))
    fail('A category with this name already exists.')
  if (p.id && p.parentId === p.id) fail("A category can't be its own parent.")
  if (p.id) {
    const c = d.categories.find((x) => x.id === p.id)
    audit(d, ctx, 'Category updated', name, { prev: c.name, next: name })
    Object.assign(c, { name, parentId: p.parentId || null })
    return c.id
  }
  const c = { id: uid('c'), name, parentId: p.parentId || null, active: true }
  d.categories.push(c)
  audit(d, ctx, 'Category created', name)
  return c.id
}

export function setCategoryActive(d, p, ctx) {
  need(ctx, 'master.edit')
  const c = d.categories.find((x) => x.id === p.id)
  c.active = p.active
  audit(d, ctx, p.active ? 'Category activated' : 'Category deactivated', c.name)
}

export function deleteCategory(d, p, ctx) {
  need(ctx, 'master.edit')
  const c = d.categories.find((x) => x.id === p.id)
  if (d.products.some((x) => x.categoryId === c.id) || d.categories.some((x) => x.parentId === c.id))
    fail('This category is used by products or sub-categories. Deactivate it instead.')
  d.categories = d.categories.filter((x) => x.id !== c.id)
  audit(d, ctx, 'Category deleted', c.name)
}

/* ---------------- Products ---------------- */

export function saveProduct(d, p, ctx) {
  need(ctx, 'products.edit')
  const sku = trim(p.sku)
  const name = trim(p.name)
  if (!sku) fail('SKU / item code is required.')
  if (!name) fail('Item name is required.')
  if (!p.categoryId) fail('Choose a category.')
  if (!trim(p.uom)) fail('Unit of measure is required.')
  if (d.products.some((x) => x.id !== p.id && x.sku.toLowerCase() === sku.toLowerCase())) fail(`SKU ${sku} is already used by another item.`)
  if (trim(p.barcode) && d.products.some((x) => x.id !== p.id && x.barcode && x.barcode === trim(p.barcode))) fail('This barcode is already used by another item.')
  const nums = ['minStock', 'reorderLevel', 'maxStock', 'cost', 'price']
  for (const k of nums) if (p[k] !== '' && p[k] != null && (!Number.isFinite(Number(p[k])) || Number(p[k]) < 0)) fail('Numbers must be 0 or more.')
  if (toNum(p.maxStock) != null && toNum(p.reorderLevel) != null && toNum(p.maxStock) < toNum(p.reorderLevel)) fail('Maximum stock should be higher than the reorder level.')
  const data = {
    sku, name, description: trim(p.description), categoryId: p.categoryId, brand: trim(p.brand), barcode: trim(p.barcode),
    uom: trim(p.uom), minStock: toNum(p.minStock), reorderLevel: toNum(p.reorderLevel), maxStock: toNum(p.maxStock),
    supplierId: p.supplierId || null, defaultLocationId: p.defaultLocationId || null, cost: toNum(p.cost), price: toNum(p.price),
  }
  if (p.id) {
    const x = d.products.find((y) => y.id === p.id)
    const changed = Object.keys(data).filter((k) => String(x[k] ?? '') !== String(data[k] ?? ''))
    if (changed.length) audit(d, ctx, 'Product updated', `${name} (${sku})`, { prev: changed.map((k) => `${k}: ${x[k] ?? '—'}`).join(', '), next: changed.map((k) => `${k}: ${data[k] ?? '—'}`).join(', ') })
    Object.assign(x, data)
    return x.id
  }
  const x = { id: uid('p'), ...data, active: true, createdAt: ctx.now }
  d.products.push(x)
  audit(d, ctx, 'Product created', `${name} (${sku})`)
  return x.id
}

export function setProductActive(d, p, ctx) {
  need(ctx, 'products.edit')
  const x = d.products.find((y) => y.id === p.id)
  x.active = p.active
  audit(d, ctx, p.active ? 'Product activated' : 'Product deactivated', `${x.name} (${x.sku})`)
}

/* ---------------- Suppliers ---------------- */

export function saveSupplier(d, p, ctx) {
  need(ctx, 'suppliers.edit')
  const name = trim(p.name)
  if (!name) fail('Supplier name is required.')
  if (d.suppliers.some((s) => s.id !== p.id && s.name.toLowerCase() === name.toLowerCase())) fail('A supplier with this name already exists.')
  if (trim(p.email) && !/^\S+@\S+\.\S+$/.test(trim(p.email))) fail('Email address looks incomplete.')
  const data = { name, contact: trim(p.contact), phone: trim(p.phone), email: trim(p.email), address: trim(p.address), terms: trim(p.terms), notes: trim(p.notes) }
  if (p.id) {
    const s = d.suppliers.find((x) => x.id === p.id)
    Object.assign(s, data)
    audit(d, ctx, 'Supplier updated', name)
    return s.id
  }
  const s = { id: uid('s'), ...data, active: true }
  d.suppliers.push(s)
  audit(d, ctx, 'Supplier created', name)
  return s.id
}

export function setSupplierActive(d, p, ctx) {
  need(ctx, 'suppliers.edit')
  const s = d.suppliers.find((x) => x.id === p.id)
  s.active = p.active
  audit(d, ctx, p.active ? 'Supplier activated' : 'Supplier deactivated', s.name)
}

/* ---------------- Warehouses & locations ---------------- */

export function saveWarehouse(d, p, ctx) {
  need(ctx, 'master.edit')
  const name = trim(p.name)
  if (!name) fail('Warehouse name is required.')
  if (d.warehouses.some((w) => w.id !== p.id && w.name.toLowerCase() === name.toLowerCase())) fail('A warehouse with this name already exists.')
  if (p.id) {
    const w = d.warehouses.find((x) => x.id === p.id)
    audit(d, ctx, 'Warehouse renamed', name, { prev: w.name, next: name })
    w.name = name
    w.address = trim(p.address)
    return w.id
  }
  const w = { id: uid('w'), name, address: trim(p.address), active: true }
  d.warehouses.push(w)
  audit(d, ctx, 'Warehouse created', name)
  return w.id
}

export function setWarehouseActive(d, p, ctx) {
  need(ctx, 'master.edit')
  const w = d.warehouses.find((x) => x.id === p.id)
  if (!p.active) {
    const held = d.locations.filter((l) => l.warehouseId === w.id).some((l) => d.products.some((pr) => balanceAt(d.ledger, pr.id, l.id) !== 0))
    if (held) fail('This warehouse still holds stock. Transfer it out first.')
  }
  w.active = p.active
  audit(d, ctx, p.active ? 'Warehouse activated' : 'Warehouse deactivated', w.name)
}

export function saveLocation(d, p, ctx) {
  need(ctx, 'master.edit')
  const name = trim(p.name)
  if (!p.warehouseId) fail('Choose a warehouse.')
  if (!name) fail('Location name is required.')
  if (d.locations.some((l) => l.id !== p.id && l.warehouseId === p.warehouseId && l.name.toLowerCase() === name.toLowerCase())) fail('This warehouse already has a location with that name.')
  if (p.id) {
    const l = d.locations.find((x) => x.id === p.id)
    audit(d, ctx, 'Location renamed', name, { prev: l.name, next: name })
    l.name = name
    return l.id
  }
  const l = { id: uid('l'), warehouseId: p.warehouseId, name, active: true }
  d.locations.push(l)
  audit(d, ctx, 'Location created', locName(d, l.id))
  return l.id
}

export function setLocationActive(d, p, ctx) {
  need(ctx, 'master.edit')
  const l = d.locations.find((x) => x.id === p.id)
  if (!p.active && d.products.some((pr) => balanceAt(d.ledger, pr.id, l.id) !== 0)) fail('This location still holds stock. Transfer it out first.')
  l.active = p.active
  audit(d, ctx, p.active ? 'Location activated' : 'Location deactivated', locName(d, l.id))
}

/* ---------------- Opening stock ---------------- */

export function enterOpeningStock(d, p, ctx) {
  need(ctx, 'opening.enter')
  const lines = (p.lines || []).filter((l) => l.productId || l.locationId || l.qty)
  if (!lines.length) fail('Add at least one line.')
  const ref = nextNumber(d, 'opening', 'OPN')
  for (const l of lines) {
    const pr = product(d, l.productId)
    location(d, l.locationId)
    const q = positiveQty(l.qty, `Quantity for ${pr.name}`)
    if (d.ledger.some((e) => e.type === 'opening' && e.productId === pr.id && e.locationId === l.locationId))
      fail(`${pr.name} already has opening stock at ${locName(d, l.locationId)}. Use a stock adjustment instead.`)
    ledger(d, ctx, { productId: pr.id, locationId: l.locationId, qty: q, type: 'opening', reference: ref })
    audit(d, ctx, 'Opening stock entered', `${pr.name} @ ${locName(d, l.locationId)}`, { prev: 0, next: q })
  }
  return ref
}

/* ---------------- Purchase orders ---------------- */

function cleanPOLines(d, lines) {
  const out = []
  for (const l of lines || []) {
    if (!l.productId && !l.qty) continue
    const pr = product(d, l.productId)
    const qty = positiveQty(l.qty, `Quantity for ${pr.name}`)
    const price = Number(l.unitPrice)
    if (!Number.isFinite(price) || price < 0) fail(`Enter a unit price for ${pr.name}.`)
    if (out.some((x) => x.productId === pr.id)) fail(`${pr.name} is listed twice. Combine the lines.`)
    out.push({ id: l.id || uid('pl'), productId: pr.id, qty, unitPrice: price, received: l.received || 0 })
  }
  if (!out.length) fail('Add at least one item.')
  return out
}

export function savePO(d, p, ctx) {
  need(ctx, 'po.edit')
  const sup = d.suppliers.find((s) => s.id === p.supplierId)
  if (!sup) fail('Choose a supplier.')
  if (!sup.active) fail(`${sup.name} is inactive.`)
  if (!p.orderDate) fail('Order date is required.')
  if (p.expectedDate && p.expectedDate < p.orderDate) fail('Expected delivery is before the order date.')
  const lines = cleanPOLines(d, p.lines)
  const status = p.confirm ? 'Ordered' : 'Draft'
  if (p.id) {
    const po = d.purchaseOrders.find((x) => x.id === p.id)
    if (po.status !== 'Draft') fail('Only draft orders can be edited.')
    Object.assign(po, { supplierId: sup.id, orderDate: p.orderDate, expectedDate: p.expectedDate || null, notes: trim(p.notes), lines, status })
    audit(d, ctx, p.confirm ? 'PO confirmed' : 'PO updated', po.number, { prev: 'Draft', next: status })
    return po.id
  }
  const po = {
    id: uid('po'), number: nextNumber(d, 'po', 'PO'), supplierId: sup.id, orderDate: p.orderDate, expectedDate: p.expectedDate || null,
    notes: trim(p.notes), lines, status, createdBy: ctx.user.id, createdAt: ctx.now,
  }
  d.purchaseOrders.push(po)
  audit(d, ctx, 'PO created', po.number, { next: status })
  return po.id
}

export function confirmPO(d, p, ctx) {
  need(ctx, 'po.edit')
  const po = d.purchaseOrders.find((x) => x.id === p.id)
  if (po.status !== 'Draft') fail('Only draft orders can be confirmed.')
  const sup = d.suppliers.find((s) => s.id === po.supplierId)
  if (!sup.active) fail(`${sup.name} is inactive.`)
  for (const l of po.lines) product(d, l.productId)
  po.status = 'Ordered'
  audit(d, ctx, 'PO confirmed', po.number, { prev: 'Draft', next: 'Ordered' })
}

export function cancelPO(d, p, ctx) {
  need(ctx, 'po.edit')
  const po = d.purchaseOrders.find((x) => x.id === p.id)
  if (!['Draft', 'Ordered'].includes(po.status)) fail('Only draft or ordered POs with nothing received can be cancelled.')
  if (po.lines.some((l) => l.received > 0)) fail('Stock has already been received on this order.')
  const prev = po.status
  po.status = 'Cancelled'
  po.cancelReason = trim(p.reason)
  audit(d, ctx, 'PO cancelled', po.number, { prev, next: 'Cancelled', reason: trim(p.reason) || null })
}

/* ---------------- Receiving ---------------- */

export function receivePO(d, p, ctx) {
  need(ctx, 'receive')
  const po = d.purchaseOrders.find((x) => x.id === p.poId)
  if (!po) fail('Choose a purchase order.')
  if (po.status === 'Cancelled') fail('Cancelled orders cannot receive stock.')
  if (!['Ordered', 'Partially Received'].includes(po.status)) fail(`This order is ${po.status} and can't receive stock.`)
  const rows = (p.lines || []).filter((r) => Number(r.qty) > 0)
  if (!rows.length) fail('Enter the quantity that arrived for at least one item.')
  const number = nextNumber(d, 'receipt', 'GRN')
  const receiptLines = []
  for (const r of rows) {
    const line = po.lines.find((l) => l.id === r.lineId)
    const pr = product(d, line.productId, { active: false })
    const q = positiveQty(r.qty, `Received quantity for ${pr.name}`)
    if (!Number.isInteger(q) && ['pcs', 'box', 'pack', 'set', 'pair'].includes(pr.uom)) fail(`${pr.name} is counted in whole ${pr.uom}.`)
    const remaining = line.qty - line.received
    if (q > remaining && !d.settings.allowOverReceive) fail(`${pr.name}: only ${remaining} left to receive on this order.`)
    if (!r.locationId) fail(`Choose where to put away ${pr.name}.`)
    location(d, r.locationId)
    line.received += q
    ledger(d, ctx, { productId: pr.id, locationId: r.locationId, qty: q, type: 'receipt', reference: `${number} · ${po.number}`, refId: po.id })
    receiptLines.push({ productId: pr.id, locationId: r.locationId, qty: q })
  }
  const prev = po.status
  po.status = po.lines.every((l) => l.received >= l.qty) ? 'Fully Received' : 'Partially Received'
  d.receipts.push({ id: uid('gr'), number, poId: po.id, at: ctx.now, userId: ctx.user.id, deliveryNote: trim(p.deliveryNote), lines: receiptLines, status: 'Completed' })
  audit(d, ctx, 'Stock received', `${number} for ${po.number}`, { prev, next: po.status })
  return number
}

/* ---------------- Transfers ---------------- */

export function transferStock(d, p, ctx) {
  need(ctx, 'transfer')
  const pr = product(d, p.productId)
  if (!p.fromLocationId || !p.toLocationId) fail('Choose both the source and destination.')
  if (p.fromLocationId === p.toLocationId) fail('Source and destination must be different.')
  location(d, p.fromLocationId)
  location(d, p.toLocationId)
  const q = positiveQty(p.qty)
  const avail = balanceAt(d.ledger, pr.id, p.fromLocationId)
  if (q > avail) fail(`Only ${avail} ${pr.uom} available at ${locName(d, p.fromLocationId)}.`)
  const number = nextNumber(d, 'transfer', 'TRF')
  ledger(d, ctx, { productId: pr.id, locationId: p.fromLocationId, qty: -q, type: 'transfer_out', reference: number })
  ledger(d, ctx, { productId: pr.id, locationId: p.toLocationId, qty: q, type: 'transfer_in', reference: number })
  d.transfers.push({ id: uid('tr'), number, at: ctx.now, userId: ctx.user.id, productId: pr.id, fromLocationId: p.fromLocationId, toLocationId: p.toLocationId, qty: q, note: trim(p.note), status: 'Completed' })
  audit(d, ctx, 'Stock transferred', `${number} · ${pr.name}`, { prev: locName(d, p.fromLocationId), next: locName(d, p.toLocationId), reason: `${q} ${pr.uom}` })
  return number
}

/* ---------------- Issues ---------------- */

export function issueStock(d, p, ctx) {
  need(ctx, 'issue')
  const pr = product(d, p.productId)
  location(d, p.locationId)
  const q = positiveQty(p.qty)
  const reason = ISSUE_REASONS.find((r) => r.id === p.reason)
  if (!reason) fail('Choose why the stock is leaving.')
  if (p.reason === 'other' && !trim(p.note)) fail('Add a note explaining the "Other" reason.')
  const avail = balanceAt(d.ledger, pr.id, p.locationId)
  if (q > avail) fail(`You can issue at most ${avail} ${pr.uom} from ${locName(d, p.locationId)}.`)
  const number = nextNumber(d, 'issue', 'ISS')
  ledger(d, ctx, { productId: pr.id, locationId: p.locationId, qty: -q, type: 'issue', reference: `${number} · ${reason.label}${trim(p.reference) ? ' · ' + trim(p.reference) : ''}` })
  d.issues.push({ id: uid('is'), number, at: ctx.now, userId: ctx.user.id, productId: pr.id, locationId: p.locationId, qty: q, reason: p.reason, reference: trim(p.reference), note: trim(p.note), status: 'Completed' })
  audit(d, ctx, 'Stock issued', `${number} · ${pr.name}`, { prev: avail, next: avail - q, reason: reason.label })
  return number
}

/* ---------------- Adjustments ---------------- */

function applyAdjustment(d, ctx, adj) {
  const pr = d.products.find((x) => x.id === adj.productId)
  const before = balanceAt(d.ledger, adj.productId, adj.locationId)
  const delta = adj.type === 'increase' ? adj.qty : -adj.qty
  if (before + delta < 0) fail(`${pr.name}: only ${before} at this location, can't decrease by ${adj.qty}.`)
  ledger(d, ctx, { productId: adj.productId, locationId: adj.locationId, qty: delta, type: 'adjustment', reference: `${adj.number} · ${adj.reason}`, refId: adj.id })
  adj.before = before
  adj.after = before + delta
  adj.approvedBy = ctx.user.id
  adj.approvedAt = ctx.now
  adj.status = 'Completed'
  audit(d, ctx, 'Stock adjusted', `${adj.number} · ${pr.name} @ ${locName(d, adj.locationId)}`, { prev: before, next: before + delta, reason: adj.reason })
}

export function createAdjustment(d, p, ctx) {
  need(ctx, 'adjust.create')
  const pr = product(d, p.productId)
  location(d, p.locationId)
  if (!['increase', 'decrease'].includes(p.type)) fail('Choose increase or decrease.')
  const q = positiveQty(p.qty)
  if (!trim(p.reason)) fail('A reason is required.')
  const adj = {
    id: uid('ad'), number: nextNumber(d, 'adjustment', 'ADJ'), productId: pr.id, locationId: p.locationId, type: p.type, qty: q,
    reason: trim(p.reason), reference: trim(p.reference), createdBy: ctx.user.id, createdAt: ctx.now, status: 'Pending Approval',
    before: balanceAt(d.ledger, pr.id, p.locationId), after: null, countId: p.countId || null,
  }
  d.adjustments.push(adj)
  audit(d, ctx, 'Adjustment requested', `${adj.number} · ${pr.name}`, { next: `${p.type === 'increase' ? '+' : '−'}${q}`, reason: adj.reason })
  if (!d.settings.requireAdjustmentApproval && can(ctx.user, 'adjust.approve')) applyAdjustment(d, ctx, adj)
  return adj.number
}

export function approveAdjustment(d, p, ctx) {
  need(ctx, 'adjust.approve')
  const adj = d.adjustments.find((x) => x.id === p.id)
  if (adj.status !== 'Pending Approval') fail('This adjustment is not waiting for approval.')
  if (d.settings.separateApprover && adj.createdBy === ctx.user.id) fail('Someone other than the requester must approve this adjustment.')
  applyAdjustment(d, ctx, adj)
}

export function rejectAdjustment(d, p, ctx) {
  need(ctx, 'adjust.approve')
  const adj = d.adjustments.find((x) => x.id === p.id)
  if (adj.status !== 'Pending Approval') fail('This adjustment is not waiting for approval.')
  adj.status = 'Rejected'
  adj.rejectReason = trim(p.reason)
  adj.approvedBy = ctx.user.id
  adj.approvedAt = ctx.now
  audit(d, ctx, 'Adjustment rejected', adj.number, { prev: 'Pending Approval', next: 'Rejected', reason: trim(p.reason) || null })
}

/* ---------------- Stock counts ---------------- */

export function createCount(d, p, ctx) {
  need(ctx, 'count.do')
  const wh = d.warehouses.find((w) => w.id === p.warehouseId)
  if (!wh) fail('Choose a warehouse.')
  const locs = d.locations.filter((l) => l.warehouseId === wh.id && l.active && (!p.locationId || l.id === p.locationId))
  if (!locs.length) fail('No active locations in this scope.')
  const lines = []
  for (const l of locs) {
    for (const pr of d.products) {
      if (!pr.active) continue
      if (p.categoryId && pr.categoryId !== p.categoryId) continue
      const bal = balanceAt(d.ledger, pr.id, l.id)
      if (bal !== 0 || pr.defaultLocationId === l.id) lines.push({ productId: pr.id, locationId: l.id, expected: null, counted: null })
    }
  }
  if (!lines.length) fail('Nothing to count in this scope yet.')
  const c = {
    id: uid('ct'), number: nextNumber(d, 'count', 'CNT'), warehouseId: wh.id, locationId: p.locationId || null, categoryId: p.categoryId || null,
    status: 'Draft', lines, createdBy: ctx.user.id, createdAt: ctx.now, note: trim(p.note),
  }
  d.counts.push(c)
  audit(d, ctx, 'Count created', c.number, { next: 'Draft' })
  return c.id
}

export function startCount(d, p, ctx) {
  need(ctx, 'count.do')
  const c = d.counts.find((x) => x.id === p.id)
  if (c.status !== 'Draft') fail('This count has already started.')
  for (const l of c.lines) l.expected = balanceAt(d.ledger, l.productId, l.locationId) // snapshot expected qty
  c.status = 'Counting'
  c.startedAt = ctx.now
  audit(d, ctx, 'Count started', c.number, { prev: 'Draft', next: 'Counting' })
}

export function saveCountLines(d, p, ctx) {
  need(ctx, 'count.do')
  const c = d.counts.find((x) => x.id === p.id)
  if (c.status !== 'Counting') fail('Counts can only be entered while counting.')
  p.counted.forEach((v, i) => {
    if (v === '' || v == null) { c.lines[i].counted = null; return }
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) fail('Counted quantities must be 0 or more.')
    c.lines[i].counted = n
  })
  if (p.submit) {
    if (c.lines.some((l) => l.counted == null)) fail('Enter a counted quantity for every line before sending for review. Enter 0 if nothing is there.')
    c.status = 'Pending Review'
    c.submittedBy = ctx.user.id
    audit(d, ctx, 'Count submitted', c.number, { prev: 'Counting', next: 'Pending Review' })
  }
}

export function reopenCount(d, p, ctx) {
  need(ctx, 'count.approve')
  const c = d.counts.find((x) => x.id === p.id)
  if (c.status !== 'Pending Review') fail('Only counts under review can be sent back.')
  c.status = 'Counting'
  audit(d, ctx, 'Count sent back', c.number, { prev: 'Pending Review', next: 'Counting', reason: trim(p.reason) || null })
}

export function approveCount(d, p, ctx) {
  need(ctx, 'count.approve')
  const c = d.counts.find((x) => x.id === p.id)
  if (c.status !== 'Pending Review') fail('This count is not waiting for review.')
  c.status = 'Approved'
  c.approvedBy = ctx.user.id
  c.approvedAt = ctx.now
  audit(d, ctx, 'Count approved', c.number, { prev: 'Pending Review', next: 'Approved' })
  // Create approved adjustments for each variance, apply them, then complete.
  const adjNumbers = []
  for (const l of c.lines) {
    const variance = l.counted - l.expected
    if (!variance) continue
    const adj = {
      id: uid('ad'), number: nextNumber(d, 'adjustment', 'ADJ'), productId: l.productId, locationId: l.locationId,
      type: variance > 0 ? 'increase' : 'decrease', qty: Math.abs(variance), reason: 'Physical count variance', reference: c.number,
      createdBy: ctx.user.id, createdAt: ctx.now, status: 'Approved', before: null, after: null, countId: c.id,
    }
    d.adjustments.push(adj)
    applyAdjustment(d, ctx, adj)
    adjNumbers.push(adj.number)
  }
  c.status = 'Completed'
  c.completedAt = ctx.now
  c.adjustments = adjNumbers
  audit(d, ctx, 'Count completed', c.number, { prev: 'Approved', next: 'Completed', reason: adjNumbers.length ? `${adjNumbers.length} adjustment(s)` : 'No variance' })
}

export function cancelCount(d, p, ctx) {
  need(ctx, 'count.do')
  const c = d.counts.find((x) => x.id === p.id)
  if (!['Draft', 'Counting'].includes(c.status)) fail('Only counts that are not yet submitted can be cancelled.')
  const prev = c.status
  c.status = 'Cancelled'
  audit(d, ctx, 'Count cancelled', c.number, { prev, next: 'Cancelled' })
}

/* ---------------- Reorder ---------------- */

export function createDraftPOs(d, p, ctx) {
  need(ctx, 'po.edit')
  const lines = (p.lines || []).filter((l) => Number(l.qty) > 0)
  if (!lines.length) fail('Select at least one item with an order quantity.')
  const bySupplier = {}
  for (const l of lines) {
    const pr = product(d, l.productId)
    if (!l.supplierId) fail(`Choose a supplier for ${pr.name}.`)
    ;(bySupplier[l.supplierId] ||= []).push({ productId: pr.id, qty: Number(l.qty), unitPrice: pr.cost || 0 })
  }
  const today = ctx.now.slice(0, 10)
  const created = []
  for (const [supplierId, ls] of Object.entries(bySupplier)) {
    created.push(savePO(d, { supplierId, orderDate: today, lines: ls, notes: 'Created from reorder list', confirm: false }, ctx))
  }
  return created
}
