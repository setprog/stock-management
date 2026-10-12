// Empty state shape and a demo data set.
// Demo data is created by running the real actions, so it follows the same rules as live use.
import * as A from './actions.js'

export const SCHEMA_VERSION = 1

export function emptyState(adminName = 'Admin') {
  return {
    version: SCHEMA_VERSION,
    settings: { currency: '$', allowOverReceive: false, requireAdjustmentApproval: true, separateApprover: false, companyName: '' },
    counters: {},
    users: [{ id: 'u_admin', name: adminName, role: 'admin', email: '', active: true }],
    categories: [],
    products: [],
    suppliers: [],
    warehouses: [],
    locations: [],
    purchaseOrders: [],
    receipts: [],
    transfers: [],
    issues: [],
    counts: [],
    adjustments: [],
    ledger: [],
    audit: [],
  }
}

const daysAgo = (n, h = 10) => {
  const t = new Date()
  t.setDate(t.getDate() - n)
  t.setHours(h, (n * 7) % 60, 0, 0)
  return t.toISOString()
}

export function demoState() {
  const d = emptyState('Admin')
  const admin = d.users[0]
  let ctx = { user: admin, now: daysAgo(40) }
  const run = (fn, p, c = ctx) => fn(d, p, c)

  const user = (name, role) => run(A.saveUser, { name, role })
  const uSelam = user('Selam A.', 'manager')
  const uMeron = user('Meron T.', 'purchasing')
  const uHana = user('Hana M.', 'storekeeper')
  const uDawit = user('Dawit K.', 'storekeeper')
  user('Guest', 'viewer')
  const as = (id, days, h) => ({ user: d.users.find((u) => u.id === id), now: daysAgo(days, h) })

  const cat = (name) => run(A.saveCategory, { name })
  const cSafety = cat('Safety')
  const cOffice = cat('Office')
  const cElec = cat('Electrical')
  const cMaint = cat('Maintenance')
  const cClean = cat('Cleaning')

  const wh = (name) => run(A.saveWarehouse, { name })
  const wMain = wh('Main Warehouse')
  const wShop = wh('Shop Store')
  const wWork = wh('Workshop')
  const loc = (warehouseId, name) => run(A.saveLocation, { warehouseId, name })
  const A01 = loc(wMain, 'Rack A01')
  const A03 = loc(wMain, 'Rack A03')
  const B01 = loc(wMain, 'Shelf B01')
  const B04 = loc(wMain, 'Shelf B04')
  const S1 = loc(wShop, 'Shelf S1')
  const S2 = loc(wShop, 'Shelf S2')
  const S3 = loc(wShop, 'Shelf S3')
  const S5 = loc(wShop, 'Shelf S5')
  const C02 = loc(wWork, 'Rack C02')
  const BIN7 = loc(wWork, 'Bin 7')

  const sup = (name, contact, phone, email, terms) => run(A.saveSupplier, { name, contact, phone, email, terms })
  const sMed = sup('MedSupply Trading', 'Ruth G.', '+251 11 555 0101', 'orders@medsupply.example', 'Net 30')
  const sOff = sup('OfficeHub', 'Samuel B.', '+251 11 555 0144', 'sales@officehub.example', 'Net 15')
  const sVolt = sup('Volt Electric', 'Yonas F.', '+251 11 555 0170', 'hello@voltelectric.example', 'Cash on delivery')
  const sFluid = sup('Fluid Works', 'Liya M.', '+251 11 555 0192', 'info@fluidworks.example', 'Net 30')

  const prod = (o) => run(A.saveProduct, o)
  const pGloves = prod({ sku: 'SAF-0112', name: 'Nitrile Gloves (M)', categoryId: cSafety, uom: 'box', reorderLevel: 40, maxStock: 200, cost: 30, price: 42, supplierId: sMed, defaultLocationId: A03, description: 'Box of 100, powder-free' })
  const pGlovesL = prod({ sku: 'SAF-0113', name: 'Nitrile Gloves (L)', categoryId: cSafety, uom: 'box', reorderLevel: 20, maxStock: 100, cost: 30, price: 42, supplierId: sMed, defaultLocationId: A03 })
  const pHelmet = prod({ sku: 'SAF-0020', name: 'Safety Helmet', categoryId: cSafety, uom: 'pcs', reorderLevel: 15, maxStock: 120, cost: 18, price: 27, supplierId: sMed, defaultLocationId: A01 })
  const pSan = prod({ sku: 'CLN-0005', name: 'Hand Sanitizer 500ml', categoryId: cClean, uom: 'bottle', reorderLevel: 10, maxStock: 40, cost: 4.5, price: 7, supplierId: sMed, defaultLocationId: S1 })
  const pPaper = prod({ sku: 'OFF-0031', name: 'A4 Copy Paper', categoryId: cOffice, uom: 'box', reorderLevel: 50, maxStock: 300, cost: 22, price: 30, supplierId: sOff, defaultLocationId: B01, description: '5 reams per box' })
  const pToner = prod({ sku: 'OFF-0145', name: 'Printer Toner 26A', categoryId: cOffice, uom: 'pcs', reorderLevel: 4, maxStock: 12, cost: 65, price: 89, supplierId: sOff, defaultLocationId: B04 })
  const pTape = prod({ sku: 'OFF-0088', name: 'Masking Tape 48mm', categoryId: cOffice, uom: 'roll', reorderLevel: 12, maxStock: 80, cost: 1.8, price: 3, supplierId: sOff, defaultLocationId: S5 })
  const pLed = prod({ sku: 'ELE-0207', name: 'LED Bulb 9W', categoryId: cElec, uom: 'pcs', reorderLevel: 30, maxStock: 250, cost: 2.4, price: 4, supplierId: sVolt, defaultLocationId: S2 })
  const pTies = prod({ sku: 'ELE-0310', name: 'Cable Ties 200mm', categoryId: cElec, uom: 'pack', reorderLevel: 25, maxStock: 100, cost: 3.2, price: 5, supplierId: sVolt, defaultLocationId: BIN7 })
  const pOil = prod({ sku: 'MNT-0044', name: 'Hydraulic Oil 5L', categoryId: cMaint, uom: 'can', reorderLevel: 20, maxStock: 80, cost: 38, price: 52, supplierId: sFluid, defaultLocationId: C02 })

  // Opening stock
  run(A.enterOpeningStock, {
    lines: [
      { productId: pGloves, locationId: A03, qty: 50 },
      { productId: pGlovesL, locationId: A03, qty: 30 },
      { productId: pHelmet, locationId: A01, qty: 60 },
      { productId: pHelmet, locationId: S3, qty: 14 },
      { productId: pSan, locationId: S1, qty: 16 },
      { productId: pPaper, locationId: B01, qty: 240 },
      { productId: pToner, locationId: B04, qty: 3 },
      { productId: pTape, locationId: S5, qty: 20 },
      { productId: pLed, locationId: A01, qty: 60 },
      { productId: pTies, locationId: BIN7, qty: 40 },
      { productId: pOil, locationId: C02, qty: 34 },
    ],
  })

  // A received PO
  const po1 = run(A.savePO, { supplierId: sMed, orderDate: daysAgo(25).slice(0, 10), lines: [{ productId: pGloves, qty: 70, unitPrice: 30 }], confirm: true }, as(uMeron, 25))
  run(A.receivePO, { poId: po1, lines: [{ lineId: d.purchaseOrders.find((x) => x.id === po1).lines[0].id, qty: 70, locationId: A03 }] }, as(uHana, 20))
  const po2 = run(A.savePO, { supplierId: sFluid, orderDate: daysAgo(12).slice(0, 10), lines: [{ productId: pOil, qty: 24, unitPrice: 38 }], confirm: true }, as(uMeron, 12))
  run(A.receivePO, { poId: po2, lines: [{ lineId: d.purchaseOrders.find((x) => x.id === po2).lines[0].id, qty: 24, locationId: C02 }] }, as(uHana, 2, 9))

  // Movements
  run(A.issueStock, { productId: pGloves, locationId: A03, qty: 60, reason: 'sale', reference: 'INV-882' }, as(uDawit, 10))
  run(A.transferStock, { productId: pGloves, fromLocationId: A03, toLocationId: S1, qty: 12 }, as(uHana, 6))
  run(A.issueStock, { productId: pGloves, locationId: A03, qty: 20, reason: 'internal' }, as(uDawit, 3))
  run(A.issueStock, { productId: pTies, locationId: BIN7, qty: 18, reason: 'internal' }, as(uDawit, 4))
  run(A.transferStock, { productId: pLed, fromLocationId: A01, toLocationId: S2, qty: 40 }, as(uHana, 1, 15))
  run(A.issueStock, { productId: pLed, locationId: S2, qty: 40, reason: 'sale', reference: 'INV-901' }, as(uDawit, 1, 16))
  run(A.issueStock, { productId: pLed, locationId: A01, qty: 20, reason: 'sale', reference: 'INV-902' }, as(uDawit, 1, 17))
  run(A.issueStock, { productId: pToner, locationId: B04, qty: 3, reason: 'internal' }, as(uDawit, 5))
  run(A.issueStock, { productId: pTape, locationId: S5, qty: 11, reason: 'internal' }, as(uDawit, 2))
  run(A.issueStock, { productId: pSan, locationId: S1, qty: 10, reason: 'sale' }, as(uDawit, 2, 14))
  run(A.issueStock, { productId: pPaper, locationId: B01, qty: 26, reason: 'internal' }, as(uDawit, 0, 9))

  // Count with a small variance
  const cnt = run(A.createCount, { warehouseId: wWork, locationId: BIN7 }, as(uSelam, 1, 11))
  run(A.startCount, { id: cnt }, as(uSelam, 1, 11))
  const c = d.counts.find((x) => x.id === cnt)
  run(A.saveCountLines, { id: cnt, counted: c.lines.map((l) => (l.productId === pTies ? l.expected - 4 : l.expected)), submit: true }, as(uHana, 1, 12))
  run(A.approveCount, { id: cnt }, as(uSelam, 1, 13))

  // Open POs (incoming)
  run(A.savePO, { supplierId: sMed, orderDate: daysAgo(8).slice(0, 10), expectedDate: daysAgo(-2).slice(0, 10), lines: [{ productId: pGloves, qty: 100, unitPrice: 30 }, { productId: pGlovesL, qty: 50, unitPrice: 30 }], confirm: true }, as(uMeron, 8))
  run(A.savePO, { supplierId: sVolt, orderDate: daysAgo(5).slice(0, 10), expectedDate: daysAgo(-4).slice(0, 10), lines: [{ productId: pLed, qty: 200, unitPrice: 2.4 }], confirm: true }, as(uMeron, 5))
  run(A.savePO, { supplierId: sOff, orderDate: daysAgo(1).slice(0, 10), lines: [{ productId: pTape, qty: 60, unitPrice: 1.8 }], confirm: false }, as(uMeron, 1))

  // A pending adjustment waiting for approval
  run(A.createAdjustment, { productId: pHelmet, locationId: A01, type: 'decrease', qty: 2, reason: 'Damaged, not recorded', reference: 'Cracked shells' }, as(uSelam, 0, 8))

  d.ledger.sort((a, b) => a.at.localeCompare(b.at))
  d.audit.sort((a, b) => b.at.localeCompare(a.at))
  return d
}
