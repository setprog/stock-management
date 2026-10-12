import { useMemo, useState } from 'react'
import { useStore, useAction } from '../data/store.jsx'
import { Link, navigate } from '../lib/router.jsx'
import { Chip, Button, Card, PageHeader, StatusChip, Field, ErrorNotice, Empty, Modal, ProductSelect, Notice, NoAccess, Tabs } from '../components/ui.jsx'
import * as A from '../data/actions.js'
import { poTotal, OPEN_PO, locationLabel } from '../data/selectors.js'
import { fmtDate, fmtMoney, fmtQty, today, fmtWhen } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ButtonGroup } from '@/components/ui/button-group'
import { Button as UIButton } from '@/components/ui/button'

/* ---------------- List ---------------- */
export function PurchaseOrders() {
  const { state, d, can } = useStore()
  const [tab, setTab] = useState('open')
  const cur = state.settings.currency
  const groups = {
    open: (p) => OPEN_PO.includes(p.status),
    draft: (p) => p.status === 'Draft',
    done: (p) => p.status === 'Fully Received' || p.status === 'Cancelled',
    all: () => true,
  }
  const rows = state.purchaseOrders.filter(groups[tab]).sort((a, b) => b.number.localeCompare(a.number))
  const n = (k) => state.purchaseOrders.filter(groups[k]).length
  return (
    <div className="page">
      <PageHeader title="Purchase orders" subtitle="Orders to suppliers. Creating an order doesn't add stock — stock goes up when you receive it."
        actions={can('po.edit') && <Button to="/purchase-orders/new" variant="primary">New purchase order</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'open', label: `Waiting delivery · ${n('open')}` }, { id: 'draft', label: `Drafts · ${n('draft')}` },
        { id: 'done', label: `Closed · ${n('done')}` }, { id: 'all', label: `All · ${n('all')}` },
      ]} />
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead>Ordered</TableHead><TableHead>Expected</TableHead><TableHead className="right">Received</TableHead><TableHead className="right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((p) => {
                const ord = p.lines.reduce((a, l) => a + l.qty, 0)
                const rec = p.lines.reduce((a, l) => a + l.received, 0)
                return (
                  <TableRow key={p.id} className="click" onClick={() => navigate('/purchase-orders/' + p.id)}>
                    <TableCell className="strong">{p.number}</TableCell>
                    <TableCell>{d.suppliers[p.supplierId]?.name}</TableCell>
                    <TableCell>{fmtDate(p.orderDate)}</TableCell>
                    <TableCell className="muted">{fmtDate(p.expectedDate)}</TableCell>
                    <TableCell className="right">{fmtQty(rec)} / {fmtQty(ord)}</TableCell>
                    <TableCell className="right">{fmtMoney(poTotal(p), cur)}</TableCell>
                    <TableCell><StatusChip status={p.status} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {!rows.length && <Empty title="Nothing here" />}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- Create / edit ---------------- */
export function POForm({ id, query }) {
  const { state, d, can } = useStore()
  const { run, error } = useAction()
  const existing = id ? state.purchaseOrders.find((p) => p.id === id) : null
  const [f, setF] = useState(() => existing
    ? { supplierId: existing.supplierId, orderDate: existing.orderDate, expectedDate: existing.expectedDate || '', notes: existing.notes, lines: existing.lines.map((l) => ({ ...l, qty: String(l.qty), unitPrice: String(l.unitPrice) })) }
    : { supplierId: query.supplier || '', orderDate: today(), expectedDate: '', notes: '', lines: [{ productId: '', qty: '', unitPrice: '' }] })
  if (!can('po.edit')) return <NoAccess />
  if (existing && existing.status !== 'Draft') return <div className="page narrow"><Notice tone="warn">Only draft orders can be edited. <Link to={'/purchase-orders/' + id}>Back to {existing.number}</Link></Notice></div>
  const cur = state.settings.currency
  const setLine = (i, patch) => setF({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const pickProduct = (i, pid) => {
    const p = d.products[pid]
    setLine(i, { productId: pid, unitPrice: p && p.cost != null && f.lines[i].unitPrice === '' ? String(p.cost) : f.lines[i].unitPrice })
  }
  const total = f.lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0)
  const submit = (confirm) => {
    const r = run(A.savePO, { ...f, id, confirm }, confirm ? 'Order confirmed — waiting for delivery' : 'Draft saved')
    if (r.ok) navigate('/purchase-orders/' + r.result)
  }
  return (
    <div className="page">
      <PageHeader crumbs={[{ label: 'Purchase orders', to: '/purchase-orders' }, { label: existing ? existing.number : 'New' }]}
        title={existing ? `Edit ${existing.number}` : 'New purchase order'} subtitle="Choose a supplier, add items, then save as a draft or confirm the order." />
      <Card pad>
        <div className="auto-grid">
          <Field label="Supplier">
            <NativeSelect className="w-full" value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
              <NativeSelectOption value="">Choose a supplier…</NativeSelectOption>
              {state.suppliers.filter((s) => s.active).map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Order date"><Input type="date" value={f.orderDate} onChange={(e) => setF({ ...f, orderDate: e.target.value })} /></Field>
          <Field label="Expected delivery" optional><Input type="date" value={f.expectedDate} onChange={(e) => setF({ ...f, expectedDate: e.target.value })} /></Field>
        </div>
      </Card>
      <Card title="Items">
        <div>
          <Table>
            <TableHeader><TableRow><TableHead style={{ minWidth: 260 }}>Item</TableHead><TableHead className="right">Quantity</TableHead><TableHead className="right">Unit price ({cur})</TableHead><TableHead className="right">Line total</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {f.lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell><ProductSelect value={l.productId} onChange={(v) => pickProduct(i, v)} size="sm" /></TableCell>
                  <TableCell className="right"><Input aria-label="Quantity" className="w-24 text-right" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} style={{ marginLeft: 'auto' }} /> <span className="small muted">{d.products[l.productId]?.uom}</span></TableCell>
                  <TableCell className="right"><Input aria-label="Unit price" className="w-24 text-right" inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} style={{ marginLeft: 'auto' }} /></TableCell>
                  <TableCell className="right strong">{fmtMoney((Number(l.qty) || 0) * (Number(l.unitPrice) || 0), cur)}</TableCell>
                  <TableCell className="right">{f.lines.length > 1 && <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })}><Icon name="x" size={16} /></Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter><TableRow><TableCell><Button variant="link" className="h-auto p-0" onClick={() => setF({ ...f, lines: [...f.lines, { productId: '', qty: '', unitPrice: '' }] })}>+ Add another item</Button></TableCell><TableCell></TableCell><TableCell className="right">Total</TableCell><TableCell className="right">{fmtMoney(total, cur)}</TableCell><TableCell></TableCell></TableRow></TableFooter>
          </Table>
        </div>
      </Card>
      <Field label="Notes" optional><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <ErrorNotice error={error} />
      <div className="actions">
        <Button variant="primary" onClick={() => submit(true)}>Confirm order</Button>
        <Button onClick={() => submit(false)}>Save as draft</Button>
        <Button to={existing ? '/purchase-orders/' + id : '/purchase-orders'} variant="ghost">Cancel</Button>
      </div>
    </div>
  )
}

/* ---------------- Detail ---------------- */
export function PODetail({ id }) {
  const { state, d, can } = useStore()
  const { run, error } = useAction()
  const [cancel, setCancel] = useState(null)
  const po = state.purchaseOrders.find((p) => p.id === id)
  if (!po) return <div className="page"><Card pad><Empty title="Order not found" /></Card></div>
  const cur = state.settings.currency
  const receipts = state.receipts.filter((r) => r.poId === id)
  const canCancel = can('po.edit') && ['Draft', 'Ordered'].includes(po.status) && po.lines.every((l) => !l.received)
  return (
    <div className="page">
      <PageHeader crumbs={[{ label: 'Purchase orders', to: '/purchase-orders' }, { label: po.number }]}
        title={<span style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>{po.number} <StatusChip status={po.status} /></span>}
        subtitle={`${d.suppliers[po.supplierId]?.name} · ordered ${fmtDate(po.orderDate)}${po.expectedDate ? ' · expected ' + fmtDate(po.expectedDate) : ''}`}
        actions={<>
          {po.status === 'Draft' && can('po.edit') && <Button to={`/purchase-orders/${id}/edit`}>Edit</Button>}
          {canCancel && <Button variant="danger" onClick={() => setCancel('')}>Cancel order</Button>}
          {po.status === 'Draft' && can('po.edit') && <Button variant="primary" onClick={() => run(A.confirmPO, { id }, 'Order confirmed')}>Confirm order</Button>}
          {OPEN_PO.includes(po.status) && can('receive') && <Button variant="primary" to={'/receive/' + id}>Receive delivery</Button>}
        </>} />
      <ErrorNotice error={error} />
      {po.status === 'Draft' && <Notice>This is a draft. Confirm it when the order is sent to the supplier — it then shows as incoming stock.</Notice>}
      {po.status === 'Cancelled' && <Notice tone="warn">Cancelled{po.cancelReason ? ': ' + po.cancelReason : ''}. Cancelled orders can't receive stock.</Notice>}
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="right">Ordered</TableHead><TableHead className="right">Received</TableHead><TableHead className="right">Still to come</TableHead><TableHead className="right">Unit price</TableHead><TableHead className="right">Line total</TableHead></TableRow></TableHeader>
            <TableBody>
              {po.lines.map((l) => {
                const p = d.products[l.productId]
                return (
                  <TableRow key={l.id}>
                    <TableCell><Link to={'/products/' + p.id} className="strong" style={{ color: 'inherit', textDecoration: 'none' }}>{p.name}</Link><div className="sub">{p.sku} · {p.uom}</div></TableCell>
                    <TableCell className="right">{fmtQty(l.qty)}</TableCell>
                    <TableCell className="right pos">{fmtQty(l.received)}</TableCell>
                    <TableCell className="right inc">{po.status === 'Cancelled' ? '—' : fmtQty(Math.max(0, l.qty - l.received))}</TableCell>
                    <TableCell className="right">{fmtMoney(l.unitPrice, cur)}</TableCell>
                    <TableCell className="right strong">{fmtMoney(l.qty * l.unitPrice, cur)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter><TableRow><TableCell colSpan={5} className="right">Order total</TableCell><TableCell className="right">{fmtMoney(poTotal(po), cur)}</TableCell></TableRow></TableFooter>
          </Table>
        </div>
      </Card>
      {po.notes && <Card title="Notes" pad><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{po.notes}</p></Card>}
      <Card title="Deliveries received">
        <Table>
          <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>When</TableHead><TableHead>Items</TableHead><TableHead>Delivery note</TableHead><TableHead>By</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {receipts.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="strong">{r.number}</TableCell><TableCell>{fmtWhen(r.at)}</TableCell>
                <TableCell className="small">{r.lines.map((l) => `+${l.qty} ${d.products[l.productId]?.name} → ${locationLabel(state, l.locationId)}`).join('; ')}</TableCell>
                <TableCell>{r.deliveryNote || '—'}</TableCell><TableCell className="muted">{d.users[r.userId]?.name}</TableCell><TableCell><StatusChip status={r.status} /></TableCell>
              </TableRow>
            ))}
            {!receipts.length && <TableRow><TableCell colSpan={6} className="muted">Nothing received yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <p className="small muted" style={{ margin: 0 }}>Created by {d.users[po.createdBy]?.name} · {fmtWhen(po.createdAt)}</p>
      {cancel !== null && (
        <Modal title={`Cancel ${po.number}?`} onClose={() => setCancel(null)}
          footer={<><Button onClick={() => setCancel(null)}>Keep order</Button><Button variant="primary" onClick={() => { const r = run(A.cancelPO, { id, reason: cancel }, 'Order cancelled'); if (r.ok) setCancel(null) }}>Cancel order</Button></>}>
          <p style={{ margin: 0 }}>The order will stay in your records but can no longer receive stock.</p>
          <Field label="Reason" optional><Input value={cancel} onChange={(e) => setCancel(e.target.value)} /></Field>
          <ErrorNotice error={error} />
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Receive: choose order ---------------- */
export function ReceiveList() {
  const { state, d } = useStore()
  const open = state.purchaseOrders.filter((p) => OPEN_PO.includes(p.status)).sort((a, b) => (a.expectedDate || '9').localeCompare(b.expectedDate || '9'))
  const recent = [...state.receipts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
  return (
    <div className="page">
      <PageHeader title="Receive stock" subtitle="Pick the purchase order the delivery belongs to." />
      <ReceiveSteps current={0} />
      <Card title="Orders waiting for delivery">
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead>Items</TableHead><TableHead>Expected</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {open.map((p) => (
                <TableRow key={p.id} className="click" onClick={() => navigate('/receive/' + p.id)}>
                  <TableCell className="strong">{p.number}</TableCell>
                  <TableCell>{d.suppliers[p.supplierId]?.name}</TableCell>
                  <TableCell className="small">{p.lines.filter((l) => l.received < l.qty).map((l) => `${d.products[l.productId]?.name} (${l.qty - l.received})`).join(', ')}</TableCell>
                  <TableCell>{fmtDate(p.expectedDate)}</TableCell>
                  <TableCell><StatusChip status={p.status} /></TableCell>
                  <TableCell className="right"><Button to={'/receive/' + p.id} size="sm">Receive</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!open.length && <Empty title="No orders waiting" action={<Button to="/purchase-orders/new">Create a purchase order</Button>}>Stock is received against a confirmed purchase order.</Empty>}
        </div>
      </Card>
      <Card title="Recently received">
        <Table>
          <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Order</TableHead><TableHead>When</TableHead><TableHead className="right">Units</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
          <TableBody>
            {recent.map((r) => (
              <TableRow key={r.id}><TableCell className="strong">{r.number}</TableCell><TableCell><Link to={'/purchase-orders/' + r.poId}>{state.purchaseOrders.find((p) => p.id === r.poId)?.number}</Link></TableCell><TableCell>{fmtWhen(r.at)}</TableCell><TableCell className="right pos">+{fmtQty(r.lines.reduce((a, l) => a + l.qty, 0))}</TableCell><TableCell className="muted">{d.users[r.userId]?.name}</TableCell></TableRow>
            ))}
            {!recent.length && <TableRow><TableCell colSpan={5} className="muted">No receipts yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function ReceiveSteps({ current }) {
  const steps = ['Choose order', 'Enter what arrived', 'Done']
  return (
    <ol className="steps" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'cur' : ''}><span className="n">{i < current ? <Icon name="tick" size={13} strokeWidth={3} /> : i + 1}</span>{s}</li>
      ))}
    </ol>
  )
}

/* ---------------- Receive: enter quantities ---------------- */
export function ReceiveForm({ poId }) {
  const { state, d, can } = useStore()
  const { run, error } = useAction()
  const po = state.purchaseOrders.find((p) => p.id === poId)
  const [rows, setRows] = useState(() => po ? po.lines.map((l) => ({ lineId: l.id, qty: String(Math.max(0, l.qty - l.received)), locationId: d.products[l.productId]?.defaultLocationId || '' })) : [])
  const [note, setNote] = useState('')
  const [done, setDone] = useState(null)
  const over = state.settings.allowOverReceive
  const activeLocs = useMemo(() => state.locations.filter((l) => l.active && d.warehouses[l.warehouseId]?.active), [state, d])

  if (!po) return <div className="page"><Card pad><Empty title="Order not found" /></Card></div>
  if (done) {
    return (
      <div className="page narrow">
        <PageHeader title="Receipt completed" />
        <ReceiveSteps current={3} />
        <Notice tone="ok">{done} saved. Stock has been added and every line is in the stock ledger.</Notice>
        <div className="actions"><Button variant="primary" to="/receive">Receive another delivery</Button><Button to={'/purchase-orders/' + poId}>View {po.number}</Button><Button to="/inventory">Go to inventory</Button></div>
      </div>
    )
  }
  if (!OPEN_PO.includes(po.status)) return <div className="page narrow"><Notice tone="warn">{po.number} is {po.status} and can't receive stock. <Link to="/receive">Choose another order</Link></Notice></div>

  const lines = po.lines.map((l, i) => {
    const r = rows[i]
    const rem = l.qty - l.received
    const q = Number(r.qty) || 0
    return { l, r, i, p: d.products[l.productId], rem, q, bad: q > rem && !over }
  })
  const leftAfter = lines.reduce((a, x) => a + Math.max(0, x.rem - x.q), 0)
  const anything = lines.some((x) => x.q > 0)
  const setRow = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const confirm = () => {
    const r = run(A.receivePO, { poId, lines: rows, deliveryNote: note }, (n) => `${n} completed — stock added`)
    if (r.ok) setDone(r.result)
  }

  return (
    <div className="page">
      <PageHeader crumbs={[{ label: 'Receive stock', to: '/receive' }, { label: po.number }]} title="Receive stock" subtitle="Count what actually arrived. Stock goes up only when you confirm." />
      <ReceiveSteps current={1} />
      <div className="row">
        <div className="grow-2 stack">
          <Card pad>
            <dl className="kv">
              <div><dt>Purchase order</dt><dd>{po.number}</dd></div>
              <div><dt>Supplier</dt><dd>{d.suppliers[po.supplierId]?.name}</dd></div>
              <div><dt>Ordered on</dt><dd>{fmtDate(po.orderDate)}</dd></div>
              <div><dt>Status</dt><dd><StatusChip status={po.status} /></dd></div>
            </dl>
          </Card>
          <Card>
            <div>
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="right">Ordered</TableHead><TableHead className="right">Received before</TableHead><TableHead>Received now</TableHead><TableHead>Put away in</TableHead></TableRow></TableHeader>
                <TableBody>
                  {lines.map(({ l, r, i, p, rem, q, bad }) => (
                    <TableRow key={l.id} style={rem <= 0 ? { opacity: 0.55 } : undefined}>
                      <TableCell style={{ minWidth: 180 }}><span className="strong">{p.name}</span><div className="sub">{p.sku} · {p.uom}</div></TableCell>
                      <TableCell className="right">{fmtQty(l.qty)}</TableCell>
                      <TableCell className="right muted">{fmtQty(l.received)}</TableCell>
                      <TableCell>
                        {rem > 0 || over ? (
                          <>
                            <ButtonGroup>
                              <UIButton variant="outline" size="icon" aria-label={`Decrease ${p.name}`} onClick={() => setRow(i, { qty: String(Math.max(0, q - 1)) })}>−</UIButton>
                              <Input className="w-16 text-center font-semibold" aria-label={`Received quantity for ${p.name}`} inputMode="decimal" value={r.qty} aria-invalid={bad ? 'true' : 'false'} onChange={(e) => setRow(i, { qty: e.target.value.replace(/[^0-9.]/g, '') })} />
                              <UIButton variant="outline" size="icon" aria-label={`Increase ${p.name}`} onClick={() => setRow(i, { qty: String(over ? q + 1 : Math.min(rem, q + 1)) })}>+</UIButton>
                            </ButtonGroup>
                            <div className={'mt-1.5 small ' + (bad ? 'text-destructive' : 'muted')}>
                              {bad ? `Only ${rem} left on this order` : rem - q > 0 ? `${rem - q} still to come` : q > rem ? `${q - rem} more than ordered` : 'All received'}
                            </div>
                          </>
                        ) : <Chip tone="ok">Fully received</Chip>}
                      </TableCell>
                      <TableCell>
                        {(rem > 0 || over) && (
                          <NativeSelect className="w-full" size="sm" style={{ minWidth: 210 }} aria-label={`Location for ${p.name}`} value={r.locationId} onChange={(e) => setRow(i, { locationId: e.target.value })}>
                            <NativeSelectOption value="">Choose…</NativeSelectOption>
                            {activeLocs.map((x) => <NativeSelectOption key={x.id} value={x.id}>{locationLabel(state, x.id)}</NativeSelectOption>)}
                          </NativeSelect>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <Field label="Delivery note number" optional><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. DN-55120" style={{ maxWidth: 320 }} /></Field>
        </div>

        <Card className="grow-1" title="What will happen">
          <div className="effect px-4 pb-4">
            {lines.filter((x) => x.q > 0).map((x) => (
              <div key={x.l.id} className="line"><Chip tone="ok">+{fmtQty(x.q)}</Chip><span>{x.p.name} added to <b>{x.r.locationId ? locationLabel(state, x.r.locationId) : '(choose a location)'}</b></span></div>
            ))}
            {!anything && <p className="muted small" style={{ margin: 0 }}>Enter the quantity that arrived for at least one item.</p>}
            <div className="divider" />
            <div className="stack-sm small">
              <span>Order will become</span>
              <span><StatusChip status={leftAfter === 0 ? 'Fully Received' : 'Partially Received'} /></span>
              <span className="muted">{leftAfter === 0 ? 'Nothing left to deliver on this order.' : `${fmtQty(leftAfter)} units still expected from the supplier.`}</span>
            </div>
            <ErrorNotice error={error} />
            {can('receive')
              ? <Button variant="primary" block disabled={!anything || lines.some((x) => x.bad)} onClick={confirm}>Confirm receipt</Button>
              : <Notice>Your role can view deliveries but not receive them.</Notice>}
            <Button to="/receive" block>Back</Button>
            <p className="small muted" style={{ margin: 0 }}>Each line is saved to the stock ledger with your name and the time.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
