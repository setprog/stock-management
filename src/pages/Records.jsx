// Stock ledger, reports, audit log and the setup checklist.
import { useMemo, useState } from 'react'
import { useStore } from '../data/store.jsx'
import { Link } from '../lib/router.jsx'
import { Button, Card, PageHeader, LedgerChip, StatusChip, StockChip, SearchBox, Empty, NoAccess, Field, Notice } from '../components/ui.jsx'
import { LEDGER_TYPES, ISSUE_REASONS, ROLES } from '../data/constants.js'
import { locationLabel, stockStatus, poTotal, setupProgress, OPEN_PO } from '../data/selectors.js'
import { fmtQty, fmtWhen, fmtMoney, fmtDate, toCSV, downloadText, today } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'

const inRange = (iso, from, to) => (!from || iso.slice(0, 10) >= from) && (!to || iso.slice(0, 10) <= to)

/* ---------------- Ledger ---------------- */
export function Ledger() {
  const { state, d } = useStore()
  const [f, setF] = useState({ q: '', type: '', wh: '', from: '', to: '' })
  const rows = useMemo(() => {
    const s = f.q.trim().toLowerCase()
    return [...state.ledger]
      .filter((e) => !f.type || e.type === f.type)
      .filter((e) => !f.wh || d.locations[e.locationId]?.warehouseId === f.wh)
      .filter((e) => inRange(e.at, f.from, f.to))
      .filter((e) => { if (!s) return true; const p = d.products[e.productId]; return [p?.name, p?.sku, e.reference].some((v) => v && v.toLowerCase().includes(s)) })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [state, d, f])
  const shown = rows.slice(0, 300)
  const exp = () => downloadText(`stock-ledger-${today()}.csv`, toCSV([
    { label: 'Date', csv: (e) => e.at }, { label: 'Type', csv: (e) => LEDGER_TYPES[e.type].label }, { label: 'SKU', csv: (e) => d.products[e.productId]?.sku },
    { label: 'Item', csv: (e) => d.products[e.productId]?.name }, { label: 'Location', csv: (e) => locationLabel(state, e.locationId) },
    { label: 'Quantity', csv: (e) => e.qty }, { label: 'Reference', key: 'reference' }, { label: 'User', csv: (e) => d.users[e.userId]?.name },
  ], rows))
  return (
    <div className="page">
      <PageHeader title="Stock ledger" subtitle="Every stock change, in order. This is the history behind every quantity in the system."
        actions={<Button onClick={exp}><Icon name="download" size={16} /> Export CSV</Button>} />
      <div className="filters">
        <SearchBox value={f.q} onChange={(q) => setF({ ...f, q })} placeholder="Item, SKU or reference" />
        <NativeSelect aria-label="Type" className="w-full" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><NativeSelectOption value="">All types</NativeSelectOption>{Object.entries(LEDGER_TYPES).map(([k, v]) => <NativeSelectOption key={k} value={k}>{v.label}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect aria-label="Warehouse" className="w-full" value={f.wh} onChange={(e) => setF({ ...f, wh: e.target.value })}><NativeSelectOption value="">All warehouses</NativeSelectOption>{state.warehouses.map((w) => <NativeSelectOption key={w.id} value={w.id}>{w.name}</NativeSelectOption>)}</NativeSelect>
        <label><span className="sr-only">From date</span><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label><span className="sr-only">To date</span><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
      </div>
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead>Location</TableHead><TableHead className="right">In</TableHead><TableHead className="right">Out</TableHead><TableHead>Reference</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
            <TableBody>
              {shown.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="muted nowrap">{fmtWhen(e.at)}</TableCell>
                  <TableCell><LedgerChip type={e.type} /></TableCell>
                  <TableCell><Link to={'/products/' + e.productId} style={{ color: 'inherit', textDecoration: 'none' }}>{d.products[e.productId]?.name}</Link></TableCell>
                  <TableCell className="small">{locationLabel(state, e.locationId)}</TableCell>
                  <TableCell className="right pos">{e.qty > 0 ? '+' + fmtQty(e.qty) : ''}</TableCell>
                  <TableCell className="right neg">{e.qty < 0 ? '−' + fmtQty(-e.qty) : ''}</TableCell>
                  <TableCell className="small">{e.reference}</TableCell>
                  <TableCell className="muted">{d.users[e.userId]?.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <Empty title="No entries match" />}
        </div>
        <div className="table-foot"><span>{rows.length > 300 ? `Showing latest 300 of ${rows.length} — export to see all` : `${rows.length} entries`}</span></div>
      </Card>
    </div>
  )
}

/* ---------------- Reports ---------------- */
function useReports() {
  const { state, d } = useStore()
  const cur = state.settings.currency
  const P = (id) => d.products[id] || {}
  const user = (id) => d.users[id]?.name
  const cat = (p) => d.categories[p.categoryId]?.name
  const loc = (id) => locationLabel(state, id)
  const stockRows = () => state.products.map((p) => {
    const q = d.onHand(p.id)
    return { p, sku: p.sku, name: p.name, category: cat(p), uom: p.uom, qty: q, inc: d.incoming.get(p.id) || 0, reorder: p.reorderLevel, value: q * (p.cost || 0), status: stockStatus(p, q), active: p.active }
  })
  return [
    { id: 'stock', label: 'Current stock', filters: ['category', 'warehouse'], rows: (f) => {
      if (f.warehouse) {
        return state.products.flatMap((p) => state.locations.filter((l) => l.warehouseId === f.warehouse).map((l) => ({ p, l, q: d.at(p.id, l.id) })).filter((x) => x.q))
          .filter((x) => !f.category || x.p.categoryId === f.category)
          .map((x) => ({ sku: x.p.sku, name: x.p.name, category: cat(x.p), uom: x.p.uom, location: loc(x.l.id), qty: x.q, value: x.q * (x.p.cost || 0), status: stockStatus(x.p, d.onHand(x.p.id)) }))
      }
      return stockRows().filter((r) => r.active && (!f.category || r.p.categoryId === f.category))
    }, cols: (f) => [
      { label: 'SKU', key: 'sku' }, { label: 'Item', key: 'name' }, { label: 'Category', key: 'category' },
      ...(f.warehouse ? [{ label: 'Location', key: 'location' }] : []),
      { label: 'Qty', key: 'qty', num: true, fmt: fmtQty }, { label: 'Unit', key: 'uom' }, { label: 'Value', key: 'value', num: true, fmt: (v) => fmtMoney(Math.round(v * 100) / 100, cur), total: true },
      { label: 'Status', key: 'status', render: (r) => <StockChip status={r.status} /> },
    ] },
    { id: 'low', label: 'Low stock', filters: ['category'], rows: (f) => stockRows().filter((r) => r.active && r.status === 'low' && (!f.category || r.p.categoryId === f.category)), cols: () => [
      { label: 'SKU', key: 'sku' }, { label: 'Item', key: 'name' }, { label: 'On hand', key: 'qty', num: true, fmt: fmtQty }, { label: 'Reorder at', key: 'reorder', num: true }, { label: 'Incoming', key: 'inc', num: true, fmt: fmtQty },
    ] },
    { id: 'out', label: 'Out of stock', filters: ['category'], rows: (f) => stockRows().filter((r) => r.active && r.status === 'out' && (!f.category || r.p.categoryId === f.category)), cols: () => [
      { label: 'SKU', key: 'sku' }, { label: 'Item', key: 'name' }, { label: 'Category', key: 'category' }, { label: 'Incoming', key: 'inc', num: true, fmt: fmtQty },
    ] },
    { id: 'valuation', label: 'Stock valuation', filters: ['category'], rows: (f) => {
      const by = {}
      for (const r of stockRows().filter((r) => r.active && (!f.category || r.p.categoryId === f.category))) {
        const k = r.category || '—'
        by[k] = by[k] || { category: k, items: 0, qty: 0, value: 0 }
        by[k].items++; by[k].qty += r.qty; by[k].value += r.value
      }
      return Object.values(by).sort((a, b) => b.value - a.value)
    }, cols: () => [
      { label: 'Category', key: 'category' }, { label: 'Items', key: 'items', num: true }, { label: 'Units', key: 'qty', num: true, fmt: fmtQty, total: true },
      { label: 'Value at cost', key: 'value', num: true, fmt: (v) => fmtMoney(Math.round(v * 100) / 100, cur), total: true },
    ] },
    { id: 'movement', label: 'Stock movement', filters: ['dates', 'product', 'category', 'warehouse', 'type'], rows: (f) => state.ledger
      .filter((e) => inRange(e.at, f.from, f.to) && (!f.product || e.productId === f.product) && (!f.category || P(e.productId).categoryId === f.category) && (!f.warehouse || d.locations[e.locationId]?.warehouseId === f.warehouse) && (!f.type || e.type === f.type))
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((e) => ({ at: e.at, type: e.type, name: P(e.productId).name, location: loc(e.locationId), in: e.qty > 0 ? e.qty : 0, out: e.qty < 0 ? -e.qty : 0, reference: e.reference, user: user(e.userId) })),
    cols: () => [
      { label: 'When', key: 'at', fmt: fmtWhen }, { label: 'Type', key: 'type', render: (r) => <LedgerChip type={r.type} />, csv: (r) => LEDGER_TYPES[r.type].label }, { label: 'Item', key: 'name' }, { label: 'Location', key: 'location' },
      { label: 'In', key: 'in', num: true, fmt: (v) => (v ? fmtQty(v) : ''), total: true }, { label: 'Out', key: 'out', num: true, fmt: (v) => (v ? fmtQty(v) : ''), total: true }, { label: 'Reference', key: 'reference' }, { label: 'By', key: 'user' },
    ] },
    { id: 'po', label: 'Purchase orders', filters: ['dates', 'supplier', 'status'], statuses: ['Draft', 'Ordered', 'Partially Received', 'Fully Received', 'Cancelled'], rows: (f) => state.purchaseOrders
      .filter((p) => inRange(p.orderDate, f.from, f.to) && (!f.supplier || p.supplierId === f.supplier) && (!f.status || p.status === f.status))
      .sort((a, b) => b.number.localeCompare(a.number))
      .map((p) => ({ number: p.number, supplier: d.suppliers[p.supplierId]?.name, date: p.orderDate, expected: p.expectedDate, ordered: p.lines.reduce((a, l) => a + l.qty, 0), received: p.lines.reduce((a, l) => a + l.received, 0), total: poTotal(p), status: p.status })),
    cols: () => [
      { label: 'PO', key: 'number' }, { label: 'Supplier', key: 'supplier' }, { label: 'Ordered', key: 'date', fmt: fmtDate }, { label: 'Expected', key: 'expected', fmt: fmtDate },
      { label: 'Units ordered', key: 'ordered', num: true }, { label: 'Units received', key: 'received', num: true }, { label: 'Total', key: 'total', num: true, fmt: (v) => fmtMoney(v, cur), total: true },
      { label: 'Status', key: 'status', render: (r) => <StatusChip status={r.status} /> },
    ] },
    { id: 'receiving', label: 'Receiving', filters: ['dates', 'supplier', 'product'], rows: (f) => state.receipts.flatMap((r) => {
      const po = state.purchaseOrders.find((p) => p.id === r.poId)
      return r.lines.map((l) => ({ at: r.at, number: r.number, po: po?.number, supplierId: po?.supplierId, supplier: d.suppliers[po?.supplierId]?.name, productId: l.productId, name: P(l.productId).name, qty: l.qty, location: loc(l.locationId), user: user(r.userId) }))
    }).filter((x) => inRange(x.at, f.from, f.to) && (!f.supplier || x.supplierId === f.supplier) && (!f.product || x.productId === f.product)).sort((a, b) => b.at.localeCompare(a.at)),
    cols: () => [{ label: 'When', key: 'at', fmt: fmtWhen }, { label: 'Receipt', key: 'number' }, { label: 'PO', key: 'po' }, { label: 'Supplier', key: 'supplier' }, { label: 'Item', key: 'name' }, { label: 'Qty', key: 'qty', num: true, total: true }, { label: 'Put away in', key: 'location' }, { label: 'By', key: 'user' }] },
    { id: 'issues', label: 'Stock issues', filters: ['dates', 'product', 'warehouse', 'reason'], rows: (f) => state.issues
      .filter((x) => inRange(x.at, f.from, f.to) && (!f.product || x.productId === f.product) && (!f.warehouse || d.locations[x.locationId]?.warehouseId === f.warehouse) && (!f.reason || x.reason === f.reason))
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((x) => ({ at: x.at, number: x.number, name: P(x.productId).name, qty: x.qty, value: x.qty * (P(x.productId).cost || 0), location: loc(x.locationId), reason: ISSUE_REASONS.find((r) => r.id === x.reason)?.label, reference: x.reference, user: user(x.userId) })),
    cols: () => [{ label: 'When', key: 'at', fmt: fmtWhen }, { label: 'Issue', key: 'number' }, { label: 'Item', key: 'name' }, { label: 'Qty', key: 'qty', num: true, total: true }, { label: 'Value', key: 'value', num: true, fmt: (v) => fmtMoney(Math.round(v * 100) / 100, cur), total: true }, { label: 'From', key: 'location' }, { label: 'Reason', key: 'reason' }, { label: 'Reference', key: 'reference' }, { label: 'By', key: 'user' }] },
    { id: 'transfers', label: 'Transfers', filters: ['dates', 'product'], rows: (f) => state.transfers
      .filter((x) => inRange(x.at, f.from, f.to) && (!f.product || x.productId === f.product)).sort((a, b) => b.at.localeCompare(a.at))
      .map((x) => ({ at: x.at, number: x.number, name: P(x.productId).name, qty: x.qty, from: loc(x.fromLocationId), to: loc(x.toLocationId), user: user(x.userId) })),
    cols: () => [{ label: 'When', key: 'at', fmt: fmtWhen }, { label: 'Transfer', key: 'number' }, { label: 'Item', key: 'name' }, { label: 'Qty', key: 'qty', num: true }, { label: 'From', key: 'from' }, { label: 'To', key: 'to' }, { label: 'By', key: 'user' }] },
    { id: 'counts', label: 'Count variance', filters: ['dates', 'warehouse'], rows: (f) => state.counts
      .filter((c) => ['Pending Review', 'Approved', 'Completed'].includes(c.status) && inRange(c.createdAt, f.from, f.to) && (!f.warehouse || c.warehouseId === f.warehouse))
      .flatMap((c) => c.lines.map((l) => ({ number: c.number, at: c.createdAt, status: c.status, name: P(l.productId).name, location: loc(l.locationId), expected: l.expected, counted: l.counted, variance: (l.counted ?? 0) - (l.expected ?? 0), value: ((l.counted ?? 0) - (l.expected ?? 0)) * (P(l.productId).cost || 0) })))
      .filter((r) => r.variance !== 0),
    cols: () => [{ label: 'Count', key: 'number' }, { label: 'Date', key: 'at', fmt: fmtDate }, { label: 'Item', key: 'name' }, { label: 'Location', key: 'location' }, { label: 'Expected', key: 'expected', num: true }, { label: 'Counted', key: 'counted', num: true }, { label: 'Variance', key: 'variance', num: true, fmt: (v) => (v > 0 ? '+' : '') + fmtQty(v) }, { label: 'Value', key: 'value', num: true, fmt: (v) => fmtMoney(Math.round(v * 100) / 100, cur), total: true }, { label: 'Status', key: 'status', render: (r) => <StatusChip status={r.status} /> }] },
    { id: 'adjustments', label: 'Adjustments', filters: ['dates', 'product', 'status'], statuses: ['Pending Approval', 'Completed', 'Rejected'], rows: (f) => state.adjustments
      .filter((a) => inRange(a.createdAt, f.from, f.to) && (!f.product || a.productId === f.product) && (!f.status || a.status === f.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => ({ at: a.createdAt, number: a.number, name: P(a.productId).name, location: loc(a.locationId), change: (a.type === 'increase' ? 1 : -1) * a.qty, before: a.before, after: a.after, reason: a.reason, by: user(a.createdBy), approver: user(a.approvedBy), status: a.status })),
    cols: () => [{ label: 'Date', key: 'at', fmt: fmtWhen }, { label: 'Adjustment', key: 'number' }, { label: 'Item', key: 'name' }, { label: 'Location', key: 'location' }, { label: 'Change', key: 'change', num: true, fmt: (v) => (v > 0 ? '+' : '') + fmtQty(v) }, { label: 'Before', key: 'before', num: true }, { label: 'After', key: 'after', num: true }, { label: 'Reason', key: 'reason' }, { label: 'Requested by', key: 'by' }, { label: 'Approved by', key: 'approver' }, { label: 'Status', key: 'status', render: (r) => <StatusChip status={r.status} /> }] },
    { id: 'supplier', label: 'Supplier purchase history', filters: ['dates', 'supplier'], rows: (f) => state.suppliers.filter((s) => !f.supplier || s.id === f.supplier).map((s) => {
      const pos = state.purchaseOrders.filter((p) => p.supplierId === s.id && !['Draft', 'Cancelled'].includes(p.status) && inRange(p.orderDate, f.from, f.to))
      return { name: s.name, orders: pos.length, open: pos.filter((p) => OPEN_PO.includes(p.status)).length, total: pos.reduce((a, p) => a + poTotal(p), 0), last: pos.map((p) => p.orderDate).sort().pop() }
    }).sort((a, b) => b.total - a.total),
    cols: () => [{ label: 'Supplier', key: 'name' }, { label: 'Orders', key: 'orders', num: true, total: true }, { label: 'Open', key: 'open', num: true }, { label: 'Total purchased', key: 'total', num: true, fmt: (v) => fmtMoney(Math.round(v * 100) / 100, cur), total: true }, { label: 'Last order', key: 'last', fmt: fmtDate }] },
  ]
}

export function Reports() {
  const { state, can } = useStore()
  const reports = useReports()
  const [id, setId] = useState('stock')
  const [f, setF] = useState({ from: '', to: '', product: '', category: '', warehouse: '', supplier: '', type: '', status: '', reason: '' })
  if (!can('reports.view')) return <NoAccess />
  const r = reports.find((x) => x.id === id)
  const rows = r.rows(f)
  const cols = r.cols(f)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const has = (k) => r.filters.includes(k)
  const exp = () => downloadText(`${r.id}-report-${today()}.csv`, toCSV(cols.map((c) => ({ label: c.label, csv: c.csv || ((row) => row[c.key]) })), rows))
  return (
    <div className="page">
      <PageHeader title="Reports" subtitle="Pick a report, narrow it with filters, and export to CSV for Excel or sharing."
        actions={<><Button onClick={() => window.print()}>Print</Button><Button variant="primary" onClick={exp}><Icon name="download" size={16} /> Export CSV</Button></>} />
      <div className="flex flex-wrap gap-2">
        {reports.map((x) => <Button key={x.id} className="rounded-full" variant={x.id === id ? 'primary' : undefined} aria-pressed={x.id === id} onClick={() => setId(x.id)}>{x.label}</Button>)}
      </div>
      <div className="filters">
        {has('dates') && <><Field label="From"><Input type="date" value={f.from} onChange={set('from')} /></Field><Field label="To"><Input type="date" value={f.to} onChange={set('to')} /></Field></>}
        {has('product') && <Field label="Item"><NativeSelect className="w-full" value={f.product} onChange={set('product')}><NativeSelectOption value="">All items</NativeSelectOption>{state.products.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>)}</NativeSelect></Field>}
        {has('category') && <Field label="Category"><NativeSelect className="w-full" value={f.category} onChange={set('category')}><NativeSelectOption value="">All categories</NativeSelectOption>{state.categories.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></Field>}
        {has('warehouse') && <Field label="Warehouse"><NativeSelect className="w-full" value={f.warehouse} onChange={set('warehouse')}><NativeSelectOption value="">All warehouses</NativeSelectOption>{state.warehouses.map((w) => <NativeSelectOption key={w.id} value={w.id}>{w.name}</NativeSelectOption>)}</NativeSelect></Field>}
        {has('supplier') && <Field label="Supplier"><NativeSelect className="w-full" value={f.supplier} onChange={set('supplier')}><NativeSelectOption value="">All suppliers</NativeSelectOption>{state.suppliers.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}</NativeSelect></Field>}
        {has('type') && <Field label="Type"><NativeSelect className="w-full" value={f.type} onChange={set('type')}><NativeSelectOption value="">All types</NativeSelectOption>{Object.entries(LEDGER_TYPES).map(([k, v]) => <NativeSelectOption key={k} value={k}>{v.label}</NativeSelectOption>)}</NativeSelect></Field>}
        {has('reason') && <Field label="Reason"><NativeSelect className="w-full" value={f.reason} onChange={set('reason')}><NativeSelectOption value="">All reasons</NativeSelectOption>{ISSUE_REASONS.map((x) => <NativeSelectOption key={x.id} value={x.id}>{x.label}</NativeSelectOption>)}</NativeSelect></Field>}
        {has('status') && <Field label="Status"><NativeSelect className="w-full" value={f.status} onChange={set('status')}><NativeSelectOption value="">All statuses</NativeSelectOption>{r.statuses.map((s) => <NativeSelectOption key={s}>{s}</NativeSelectOption>)}</NativeSelect></Field>}
      </div>
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow>{cols.map((c) => <TableHead key={c.label} className={c.num ? 'right' : ''}>{c.label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.slice(0, 500).map((row, i) => (
                <TableRow key={i}>{cols.map((c) => <TableCell key={c.label} className={c.num ? 'right' : ''}>{c.render ? c.render(row) : c.fmt ? c.fmt(row[c.key]) : row[c.key] ?? '—'}</TableCell>)}</TableRow>
              ))}
            </TableBody>
            {rows.length > 0 && cols.some((c) => c.total) && (
              <TableFooter><TableRow>{cols.map((c, i) => <TableCell key={c.label} className={c.num ? 'right' : ''}>{i === 0 ? 'Total' : c.total ? (c.fmt || fmtQty)(rows.reduce((a, row) => a + (Number(row[c.key]) || 0), 0)) : ''}</TableCell>)}</TableRow></TableFooter>
            )}
          </Table>
          {!rows.length && <Empty title="No data for these filters" />}
        </div>
        <div className="table-foot"><span>{rows.length} rows{rows.length > 500 ? ' — showing first 500, export for all' : ''}</span></div>
      </Card>
    </div>
  )
}

/* ---------------- Audit log ---------------- */
export function Audit() {
  const { state, d, can } = useStore()
  const [q, setQ] = useState('')
  const [u, setU] = useState('')
  if (!can('audit.view')) return <NoAccess />
  const s = q.trim().toLowerCase()
  const rows = state.audit.filter((a) => (!u || a.userId === u) && (!s || [a.action, a.record, a.reason].some((v) => v && String(v).toLowerCase().includes(s))))
  const exp = () => downloadText(`audit-log-${today()}.csv`, toCSV([
    { label: 'Date/time', key: 'at' }, { label: 'User', csv: (a) => d.users[a.userId]?.name }, { label: 'Action', key: 'action' }, { label: 'Record', key: 'record' },
    { label: 'Previous value', key: 'prev' }, { label: 'New value', key: 'next' }, { label: 'Reason', key: 'reason' },
  ], rows))
  return (
    <div className="page">
      <PageHeader title="Audit log" subtitle="Who did what, and when. Entries can't be edited or deleted."
        actions={<Button onClick={exp}><Icon name="download" size={16} /> Export CSV</Button>} />
      <div className="filters">
        <SearchBox value={q} onChange={setQ} placeholder="Search action, record or reason" />
        <NativeSelect aria-label="User" className="w-full" value={u} onChange={(e) => setU(e.target.value)}><NativeSelectOption value="">All users</NativeSelectOption>{state.users.map((x) => <NativeSelectOption key={x.id} value={x.id}>{x.name} · {ROLES[x.role].label}</NativeSelectOption>)}</NativeSelect>
      </div>
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>Previous</TableHead><TableHead>New</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.slice(0, 400).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="muted nowrap">{fmtWhen(a.at)}</TableCell><TableCell>{d.users[a.userId]?.name}</TableCell><TableCell className="strong">{a.action}</TableCell>
                  <TableCell className="small">{a.record}</TableCell><TableCell className="small muted">{a.prev ?? '—'}</TableCell><TableCell className="small">{a.next ?? '—'}</TableCell><TableCell className="small">{a.reason ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <Empty title="No entries match" />}
        </div>
        <div className="table-foot"><span>{rows.length} entries{rows.length > 400 ? ' — showing latest 400, export for all' : ''}</span></div>
      </Card>
    </div>
  )
}

/* ---------------- Setup checklist ---------------- */
export function Setup() {
  const { state } = useStore()
  const s = setupProgress(state)
  return (
    <div className="page narrow">
      <PageHeader title="Set up your system" subtitle="Do these once, in order. When every step is ticked you're ready for daily work." />
      <Card>
        <ol className="check-list">
          {s.steps.map((st, i) => (
            <li key={st.id}>
              <span className={'tick' + (st.done ? ' done' : '')}>{st.done && <Icon name="tick" size={14} strokeWidth={3} />}</span>
              <span style={{ flex: 1 }}><span className="muted small">Step {i + 1}</span><br /><span className="strong">{st.label}</span></span>
              <Button to={st.to} variant={st.done ? undefined : 'primary'} size="sm">{st.done ? 'Review' : 'Start'}</Button>
            </li>
          ))}
        </ol>
      </Card>
      {s.ready
        ? <Notice tone="ok" icon="tick">Your system is ready for operations. <Link to="/" className="strong">Go to the dashboard →</Link></Notice>
        : <p className="muted small" style={{ margin: 0 }}>{s.done} of {s.steps.length} done.</p>}
    </div>
  )
}
