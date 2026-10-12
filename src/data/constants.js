// Roles, permissions, statuses and fixed lists from the MVP requirements.

export const ROLES = {
  admin: { label: 'Admin', blurb: 'Full system access and configuration' },
  manager: { label: 'Inventory Manager', blurb: 'Products, inventory, transfers, counts, adjustments, reports' },
  purchasing: { label: 'Purchasing Officer', blurb: 'Suppliers, purchase orders, receiving visibility' },
  storekeeper: { label: 'Storekeeper', blurb: 'Receiving, transfers, issues, counts, viewing stock' },
  viewer: { label: 'Viewer', blurb: 'Read-only access' },
}

// Every permission key used by the app.
export const PERMS = [
  'users.manage', // users & roles, settings
  'master.edit', // categories, warehouses & locations
  'products.edit',
  'suppliers.edit',
  'opening.enter',
  'po.edit', // create / confirm / cancel purchase orders, reorder
  'receive',
  'transfer',
  'issue',
  'count.do', // create and count
  'count.approve',
  'adjust.create',
  'adjust.approve',
  'reports.view',
  'audit.view',
]

const ROLE_PERMS = {
  admin: PERMS,
  manager: [
    'products.edit', 'master.edit', 'opening.enter', 'transfer', 'count.do', 'count.approve',
    'adjust.create', 'adjust.approve', 'reports.view', 'audit.view',
  ],
  purchasing: ['suppliers.edit', 'po.edit', 'reports.view'],
  storekeeper: ['receive', 'transfer', 'issue', 'count.do'],
  viewer: [],
}

export function can(user, perm) {
  if (!user) return false
  return (ROLE_PERMS[user.role] || []).includes(perm)
}

export const ISSUE_REASONS = [
  { id: 'sale', label: 'Sale' },
  { id: 'internal', label: 'Internal use' },
  { id: 'production', label: 'Production' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'lost', label: 'Lost' },
  { id: 'sample', label: 'Sample' },
  { id: 'donation', label: 'Donation' },
  { id: 'other', label: 'Other' },
]

export const ADJUST_REASONS = [
  'Physical count variance',
  'Found stock',
  'Damaged, not recorded',
  'Data entry correction',
  'Expired',
  'Other',
]

export const UOMS = ['pcs', 'box', 'pack', 'roll', 'can', 'bottle', 'kg', 'g', 'l', 'ml', 'm', 'set', 'pair']

export const LEDGER_TYPES = {
  opening: { label: 'Opening stock', tone: 'neutral' },
  receipt: { label: 'Received', tone: 'ok' },
  issue: { label: 'Issued', tone: 'bad' },
  transfer_out: { label: 'Transfer out', tone: 'info' },
  transfer_in: { label: 'Transfer in', tone: 'info' },
  adjustment: { label: 'Adjusted', tone: 'neutral' },
}

// Status → chip tone
export const STATUS_TONE = {
  Draft: 'neutral',
  Ordered: 'info',
  'Partially Received': 'warn',
  'Fully Received': 'ok',
  Cancelled: 'neutral',
  Processing: 'info',
  Completed: 'ok',
  Counting: 'info',
  'Pending Review': 'warn',
  'Pending Approval': 'warn',
  Approved: 'ok',
  Rejected: 'bad',
  Active: 'ok',
  Inactive: 'neutral',
}

export const STOCK_STATUS = {
  ok: { label: 'In stock', tone: 'ok' },
  low: { label: 'Low stock', tone: 'warn' },
  out: { label: 'Out of stock', tone: 'bad' },
}
