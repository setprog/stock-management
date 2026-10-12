import { useMemo, useState } from 'react'
import { useStore } from '../data/store.jsx'
import { Link, navigate } from '../lib/router.jsx'
import { Button, Card, Notice, PageHeader, SearchBox, StockChip, Tabs, Empty } from '../components/ui.jsx'
import { stockStatus, locationLabel } from '../data/selectors.js'
import { fmtMoney, fmtQty } from '../lib/format.js'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export default function Inventory({ query }) {
  const { state, d, can } = useStore()
  const [tab, setTab] = useState(query.status || 'all')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [wh, setWh] = useState('')
  const [view, setView] = useState('items')
  const [showInactive, setShowInactive] = useState(false)
  const cur = state.settings.currency

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return state.products
      .filter((p) => showInactive || p.active)
      .filter((p) => !s || [p.name, p.sku, p.barcode].some((v) => v && v.toLowerCase().includes(s)))
      .filter((p) => !cat || p.categoryId === cat)
      .map((p) => {
        const locs = state.locations.filter((l) => (!wh || l.warehouseId === wh)).map((l) => ({ l, q: d.at(p.id, l.id) })).filter((x) => x.q !== 0)
        const qty = wh ? locs.reduce((a, x) => a + x.q, 0) : d.onHand(p.id)
        const total = d.onHand(p.id)
        return { p, qty, locs, status: stockStatus(p, total), inc: d.incoming.get(p.id) || 0 }
      })
      .filter((r) => !wh || r.locs.length)
      .sort((a, b) => a.p.name.localeCompare(b.p.name))
  }, [state, d, q, cat, wh, showInactive])

  const counts = { all: rows.length, low: 0, out: 0, ok: 0 }
  rows.forEach((r) => counts[r.status]++)
  const shown = rows.filter((r) => tab === 'all' || r.status === tab)
  const locRows = shown.flatMap((r) => r.locs.map((x) => ({ ...r, loc: x.l, lq: x.q })))

  return (
    <div className="page">
      <PageHeader title="Inventory" subtitle="What you have right now, and where it is."
        actions={<>
          {can('receive') && <Button to="/receive">Receive stock</Button>}
          {can('issue') && <Button to="/issue" variant="primary">Issue stock</Button>}
        </>} />

      <Notice>Quantities can't be typed in directly. They change only when you <b>receive</b>, <b>issue</b>, <b>transfer</b>, <b>count</b> or <b>adjust</b> stock — so every number has a history.</Notice>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'all', label: `All items · ${counts.all}` },
        { id: 'low', label: `Low stock · ${counts.low}` },
        { id: 'out', label: `Out of stock · ${counts.out}` },
        { id: 'ok', label: `In stock · ${counts.ok}` },
      ]} />

      <div className="filters">
        <SearchBox value={q} onChange={setQ} placeholder="Search by name, SKU or barcode" label="Search items" />
        
          <NativeSelect aria-label="Category" className="w-full" value={cat} onChange={(e) => setCat(e.target.value)}>
            <NativeSelectOption value="">All categories</NativeSelectOption>
            {state.categories.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
          </NativeSelect>
        
          <NativeSelect aria-label="Warehouse" className="w-full" value={wh} onChange={(e) => setWh(e.target.value)}>
            <NativeSelectOption value="">All warehouses</NativeSelectOption>
            {state.warehouses.map((w) => <NativeSelectOption key={w.id} value={w.id}>{w.name}</NativeSelectOption>)}
          </NativeSelect>
        
          <NativeSelect aria-label="View" className="w-full" value={view} onChange={(e) => setView(e.target.value)}>
            <NativeSelectOption value="items">One row per item</NativeSelectOption>
            <NativeSelectOption value="locations">One row per location</NativeSelectOption>
          </NativeSelect>
      </div>

      <Card>
        <div>
          {view === 'items' ? (
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Where</TableHead><TableHead className="right">On hand</TableHead><TableHead className="right">Incoming</TableHead><TableHead className="right">Reorder at</TableHead><TableHead className="right">Value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {shown.map(({ p, qty, locs, status, inc }) => (
                  <TableRow key={p.id} className={'click' + (p.active ? '' : ' inactive')} onClick={() => navigate('/products/' + p.id)}>
                    <TableCell><Link to={'/products/' + p.id} className="strong" style={{ color: 'inherit', textDecoration: 'none' }}>{p.name}</Link><div className="sub">{p.sku}{!p.active && ' · inactive'}</div></TableCell>
                    <TableCell className="muted">{d.categories[p.categoryId]?.name}</TableCell>
                    <TableCell className="muted small">{locs.length === 0 ? '—' : locs.length === 1 ? locationLabel(state, locs[0].l.id) : `${locs.length} locations`}</TableCell>
                    <TableCell className="right strong">{fmtQty(qty)} <span className="muted" style={{ fontWeight: 400 }}>{p.uom}</span></TableCell>
                    <TableCell className="right inc">{inc ? fmtQty(inc) : '—'}</TableCell>
                    <TableCell className="right muted">{p.reorderLevel ?? '—'}</TableCell>
                    <TableCell className="right muted">{fmtMoney(Math.round(qty * (p.cost || 0)), cur)}</TableCell>
                    <TableCell><StockChip status={status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Warehouse · Location</TableHead><TableHead className="right">Quantity</TableHead><TableHead>Item status</TableHead></TableRow></TableHeader>
              <TableBody>
                {locRows.map((r) => (
                  <TableRow key={r.p.id + r.loc.id} className="click" onClick={() => navigate('/products/' + r.p.id)}>
                    <TableCell><span className="strong">{r.p.name}</span><div className="sub">{r.p.sku}</div></TableCell>
                    <TableCell>{locationLabel(state, r.loc.id)}</TableCell>
                    <TableCell className="right strong">{fmtQty(r.lq)} <span className="muted" style={{ fontWeight: 400 }}>{r.p.uom}</span></TableCell>
                    <TableCell><StockChip status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {(view === 'items' ? !shown.length : !locRows.length) && (
            <Empty title="No items match" action={state.products.length === 0 && can('products.edit') ? <Button to="/products/new" variant="primary">Add your first product</Button> : null}>
              {state.products.length === 0 ? 'You have no products yet.' : 'Try another search or filter.'}
            </Empty>
          )}
        </div>
        <div className="table-foot">
          <span>Showing {view === 'items' ? shown.length : locRows.length} {view === 'items' ? 'items' : 'stock locations'}</span>
          <Label className="font-normal"><Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} /> Show inactive items</Label>
        </div>
      </Card>
    </div>
  )
}
