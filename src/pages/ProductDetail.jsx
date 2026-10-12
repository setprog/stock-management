import { useMemo } from 'react'
import { useStore, useAction } from '../data/store.jsx'
import { Link } from '../lib/router.jsx'
import { Button, Card, LedgerChip, PageHeader, StockChip, ActiveChip, Empty, ErrorNotice } from '../components/ui.jsx'
import { stockStatus, locationLabel, OPEN_PO } from '../data/selectors.js'
import { fmtMoney, fmtQty, fmtWhen } from '../lib/format.js'
import { setProductActive } from '../data/actions.js'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function ProductDetail({ id }) {
  const { state, d, can } = useStore()
  const { run, error } = useAction()
  const p = d.products[id]

  const data = useMemo(() => {
    if (!p) return null
    const entries = state.ledger.filter((e) => e.productId === id).sort((a, b) => a.at.localeCompare(b.at))
    let bal = 0
    const withBal = entries.map((e) => { bal += e.qty; return { ...e, bal } }).reverse()
    const locs = state.locations.map((l) => ({ l, q: d.at(id, l.id) })).filter((x) => x.q !== 0)
    const openPOs = state.purchaseOrders.filter((po) => OPEN_PO.includes(po.status) && po.lines.some((l) => l.productId === id && l.received < l.qty))
    return { withBal, locs, openPOs }
  }, [state, d, id, p])

  if (!p) return <div className="page"><Card pad><Empty title="Item not found" action={<Button to="/inventory">Back to inventory</Button>} /></Card></div>

  const onHand = d.onHand(id)
  const inc = d.incoming.get(id) || 0
  const status = stockStatus(p, onHand)
  const cur = state.settings.currency

  return (
    <div className="page">
      <PageHeader
        crumbs={[{ label: 'Inventory', to: '/inventory' }, { label: p.name }]}
        title={<span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>{p.name} <StockChip status={status} />{!p.active && <ActiveChip active={false} />}</span>}
        subtitle={[`SKU ${p.sku}`, d.categories[p.categoryId]?.name, `Unit: ${p.uom}`, p.supplierId && `Supplier: ${d.suppliers[p.supplierId]?.name}`, p.barcode && `Barcode ${p.barcode}`].filter(Boolean).join(' · ')}
        actions={<>
          {p.active && can('receive') && <Button to="/receive">Receive</Button>}
          {p.active && can('issue') && <Button to={'/issue?product=' + id}>Issue</Button>}
          {p.active && can('transfer') && <Button to={'/transfer?product=' + id}>Transfer</Button>}
          {can('products.edit') && <Button to={`/products/${id}/edit`}>Edit</Button>}
          {p.active && can('po.edit') && status !== 'ok' && <Button to="/reorder" variant="primary">Reorder</Button>}
        </>}
      />
      <ErrorNotice error={error} />
      {p.description && <p style={{ margin: 0 }} className="muted">{p.description}</p>}

      <section className="stats" aria-label="Stock summary">
        <div className="stat"><div className="stat-label">On hand</div><div className="stat-value">{fmtQty(onHand)} <small>{p.uom}</small></div></div>
        <div className="stat"><div className="stat-label">Incoming</div><div className="stat-value inc">{fmtQty(inc)} <small>{data.openPOs.map((x) => x.number).join(', ')}</small></div></div>
        <div className="stat"><div className="stat-label">Reorder level</div><div className="stat-value">{p.reorderLevel ?? '—'} <small>{p.maxStock != null ? `· max ${p.maxStock}` : ''}{p.minStock != null ? ` · min ${p.minStock}` : ''}</small></div></div>
        <div className="stat"><div className="stat-label">Stock value</div><div className="stat-value">{fmtMoney(Math.round(onHand * (p.cost || 0) * 100) / 100, cur)} <small>at {fmtMoney(p.cost, cur)}</small></div></div>
      </section>

      <div className="row">
        <Card className="grow-1" title="Where it is">
          <Table>
            <TableHeader><TableRow><TableHead>Location</TableHead><TableHead className="right">Qty</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.locs.map(({ l, q }) => <TableRow key={l.id}><TableCell>{locationLabel(state, l.id)}{p.defaultLocationId === l.id && <span className="muted small"> · default</span>}</TableCell><TableCell className="right strong">{fmtQty(q)}</TableCell></TableRow>)}
              {!data.locs.length && <TableRow><TableCell colSpan={2} className="muted">Not stored anywhere right now.</TableCell></TableRow>}
            </TableBody>
            {data.locs.length > 1 && <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="right">{fmtQty(onHand)}</TableCell></TableRow></TableFooter>}
          </Table>
        </Card>

        <Card className="grow-2" title="Stock history" actions={<span className="small muted">Every change, newest first</span>}>
          <div>
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>What happened</TableHead><TableHead>Reference</TableHead><TableHead>Location</TableHead><TableHead className="right">In</TableHead><TableHead className="right">Out</TableHead><TableHead className="right">Balance</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.withBal.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="muted nowrap">{fmtWhen(e.at)}</TableCell>
                    <TableCell><LedgerChip type={e.type} /></TableCell>
                    <TableCell className="small">{e.reference}</TableCell>
                    <TableCell className="small muted">{locationLabel(state, e.locationId)}</TableCell>
                    <TableCell className="right pos">{e.qty > 0 ? '+' + fmtQty(e.qty) : ''}</TableCell>
                    <TableCell className="right neg">{e.qty < 0 ? '−' + fmtQty(-e.qty) : ''}</TableCell>
                    <TableCell className="right strong">{fmtQty(e.bal)}</TableCell>
                    <TableCell className="muted">{d.users[e.userId]?.name}</TableCell>
                  </TableRow>
                ))}
                {!data.withBal.length && <TableRow><TableCell colSpan={8} className="muted">No movements yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {can('products.edit') && (
        <div>
          {p.active
            ? <Button variant="link" className="h-auto p-0" onClick={() => run(setProductActive, { id, active: false }, `${p.name} deactivated`)}>Deactivate this item</Button>
            : <Button variant="link" className="h-auto p-0" onClick={() => run(setProductActive, { id, active: true }, `${p.name} activated`)}>Activate this item</Button>}
          <span className="small muted"> — inactive items can't be used in new transactions but keep their history.</span>
        </div>
      )}
      <div className="small muted">Prices: cost {fmtMoney(p.cost, cur)} · selling {fmtMoney(p.price, cur)}{p.brand ? ` · Brand/model: ${p.brand}` : ''} · <Link to="/ledger">Open full ledger</Link></div>
    </div>
  )
}
