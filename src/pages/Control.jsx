// Stock counts, adjustments and reorder.
import { useMemo, useState } from 'react'
import { useStore, useAction } from '../data/store.jsx'
import { Link, navigate } from '../lib/router.jsx'
import { Button, Card, PageHeader, Field, ErrorNotice, Notice, ProductSelect, LocationSelect, StatusChip, StockChip, Modal, Empty, Tabs, Steps } from '../components/ui.jsx'
import * as A from '../data/actions.js'
import { ADJUST_REASONS } from '../data/constants.js'
import { locationLabel, stockStatus, suggestedQty } from '../data/selectors.js'
import { fmtQty, fmtWhen, fmtMoney } from '../lib/format.js'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

/* ---------------- Counts list ---------------- */
export function Counts() {
  const { state, d, can } = useStore()
  const { run, error, setError } = useAction()
  const [create, setCreate] = useState(null)
  const rows = [...state.counts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const start = () => {
    const r = run(A.createCount, create, 'Count created')
    if (r.ok) navigate('/counts/' + r.result)
  }
  return (
    <div className="page">
      <PageHeader title="Stock counts" subtitle="Compare what's on the shelves with what the system expects. Differences become approved adjustments — stock is never just overwritten."
        actions={can('count.do') && <Button variant="primary" onClick={() => { setError(''); setCreate({ warehouseId: state.warehouses.find((w) => w.active)?.id || '', locationId: '', categoryId: '', note: '' }) }}>Start a count</Button>} />
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>Count</TableHead><TableHead>Scope</TableHead><TableHead className="right">Lines</TableHead><TableHead>Created</TableHead><TableHead>By</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className="click" onClick={() => navigate('/counts/' + c.id)}>
                  <TableCell className="strong">{c.number}</TableCell>
                  <TableCell>{c.locationId ? locationLabel(state, c.locationId) : d.warehouses[c.warehouseId]?.name + ' (all locations)'}{c.categoryId && <span className="muted"> · {d.categories[c.categoryId]?.name}</span>}</TableCell>
                  <TableCell className="right">{c.lines.length}</TableCell>
                  <TableCell>{fmtWhen(c.createdAt)}</TableCell>
                  <TableCell className="muted">{d.users[c.createdBy]?.name}</TableCell>
                  <TableCell><StatusChip status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <Empty title="No counts yet">Start with one shelf or bin — small counts are quicker and more accurate.</Empty>}
        </div>
      </Card>
      {create && (
        <Modal title="Start a stock count" onClose={() => setCreate(null)}
          footer={<><Button onClick={() => setCreate(null)}>Cancel</Button><Button variant="primary" onClick={start}>Create count</Button></>}>
          <Field label="Warehouse">
            <NativeSelect className="w-full" value={create.warehouseId} onChange={(e) => setCreate({ ...create, warehouseId: e.target.value, locationId: '' })}>
              {state.warehouses.filter((w) => w.active).map((w) => <NativeSelectOption key={w.id} value={w.id}>{w.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Location" optional hint="Leave empty to count the whole warehouse"><LocationSelect value={create.locationId} onChange={(v) => setCreate({ ...create, locationId: v })} warehouseId={create.warehouseId} placeholder="All locations" /></Field>
          <Field label="Category" optional>
            <NativeSelect className="w-full" value={create.categoryId} onChange={(e) => setCreate({ ...create, categoryId: e.target.value })}>
              <NativeSelectOption value="">All categories</NativeSelectOption>
              {state.categories.filter((c) => c.active).map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <ErrorNotice error={error} />
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Count detail ---------------- */
const COUNT_STEPS = ['Draft', 'Counting', 'Pending Review', 'Completed']

export function CountDetail({ id }) {
  const { state, d, can } = useStore()
  const { run, error } = useAction()
  const c = state.counts.find((x) => x.id === id)
  const [vals, setVals] = useState(() => (c ? c.lines.map((l) => (l.counted == null ? '' : String(l.counted))) : []))
  const [hideExpected, setHideExpected] = useState(true)
  if (!c) return <div className="page"><Card pad><Empty title="Count not found" /></Card></div>
  const step = c.status === 'Cancelled' ? -1 : COUNT_STEPS.indexOf(c.status === 'Approved' ? 'Completed' : c.status)
  const counting = c.status === 'Counting'
  const showExpected = c.status !== 'Counting' || !hideExpected
  const variance = (i) => {
    const v = counting ? vals[i] : c.lines[i].counted
    if (v === '' || v == null || c.lines[i].expected == null) return null
    return Number(v) - c.lines[i].expected
  }
  const filled = vals.filter((v) => v !== '').length
  const withVar = c.lines.filter((_, i) => variance(i)).length
  const cur = state.settings.currency
  const varValue = c.lines.reduce((a, l, i) => a + (variance(i) || 0) * (d.products[l.productId]?.cost || 0), 0)

  return (
    <div className="page">
      <PageHeader crumbs={[{ label: 'Stock counts', to: '/counts' }, { label: c.number }]}
        title={<span style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>{c.number} <StatusChip status={c.status} /></span>}
        subtitle={(c.locationId ? locationLabel(state, c.locationId) : d.warehouses[c.warehouseId]?.name + ' — all locations') + (c.categoryId ? ' · ' + d.categories[c.categoryId]?.name : '')}
        actions={<>
          {['Draft', 'Counting'].includes(c.status) && can('count.do') && <Button variant="danger" onClick={() => run(A.cancelCount, { id }, 'Count cancelled')}>Cancel count</Button>}
        </>} />
      {step >= 0 && <Steps steps={['Prepare', 'Count shelves', 'Review', 'Done']} current={step === 3 ? 4 : step} />}
      <ErrorNotice error={error} />

      {c.status === 'Draft' && (
        <Notice>
          {c.lines.length} lines are ready. When you press <b>Start counting</b> the system records what it expects at that moment.
          {can('count.do') && <div style={{ marginTop: 10 }}><Button variant="primary" onClick={() => run(A.startCount, { id }, 'Counting started')}>Start counting</Button></div>}
        </Notice>
      )}
      {counting && (
        <Notice>Count what is physically on each shelf and type the number. Enter 0 if the item isn't there. Expected quantities are hidden so they don't influence the count.</Notice>
      )}
      {c.status === 'Pending Review' && (
        <Notice tone="warn">
          {withVar ? `${withVar} line(s) differ from the system, worth ${fmtMoney(Math.round(varValue * 100) / 100, cur)} at cost.` : 'No differences found.'} Approving creates an adjustment for each difference and updates stock.
          {can('count.approve') && <div className="actions" style={{ marginTop: 10 }}>
            <Button variant="primary" onClick={() => run(A.approveCount, { id }, 'Count approved — stock updated')}>Approve and update stock</Button>
            <Button onClick={() => { run(A.reopenCount, { id }, 'Sent back for recounting'); setVals(c.lines.map((l) => (l.counted == null ? '' : String(l.counted)))) }}>Send back for recount</Button>
          </div>}
        </Notice>
      )}
      {c.status === 'Completed' && (
        <Notice tone="ok">Completed {fmtWhen(c.completedAt)}. {c.adjustments?.length ? `Adjustments created: ${c.adjustments.join(', ')}.` : 'No variance — nothing needed adjusting.'}</Notice>
      )}

      <Card actions={counting && <Label className="font-normal"><Checkbox checked={!hideExpected} onCheckedChange={(v) => setHideExpected(v !== true)} /> Show expected quantities</Label>}
        title={counting ? `Counted ${filled} of ${c.lines.length}` : 'Lines'}>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Location</TableHead>{showExpected && <TableHead className="right">Expected</TableHead>}<TableHead className="right">Counted</TableHead>{showExpected && <TableHead className="right">Difference</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {c.lines.map((l, i) => {
                const p = d.products[l.productId]
                const v = variance(i)
                return (
                  <TableRow key={i}>
                    <TableCell><span className="strong">{p.name}</span><div className="sub">{p.sku} · {p.uom}</div></TableCell>
                    <TableCell className="small">{locationLabel(state, l.locationId)}</TableCell>
                    {showExpected && <TableCell className="right muted">{l.expected == null ? '—' : fmtQty(l.expected)}</TableCell>}
                    <TableCell className="right">
                      {counting
                        ? <Input aria-label={`Counted ${p.name}`} className="w-24 text-right" inputMode="decimal" value={vals[i]} onChange={(e) => setVals(vals.map((x, j) => (j === i ? e.target.value.replace(/[^0-9.]/g, '') : x)))} style={{ marginLeft: 'auto' }} />
                        : <span className="strong">{l.counted == null ? '—' : fmtQty(l.counted)}</span>}
                    </TableCell>
                    {showExpected && <TableCell className={'right ' + (v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted')}>{v == null ? '—' : v === 0 ? 'Match' : (v > 0 ? '+' : '−') + fmtQty(Math.abs(v))}</TableCell>}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      {counting && can('count.do') && (
        <div className="actions">
          <Button variant="primary" onClick={() => run(A.saveCountLines, { id, counted: vals, submit: true }, 'Sent for review')}>Send for review</Button>
          <Button onClick={() => run(A.saveCountLines, { id, counted: vals }, 'Progress saved')}>Save progress</Button>
        </div>
      )}
    </div>
  )
}

/* ---------------- Adjustments ---------------- */
export function Adjustments() {
  const { state, d, can } = useStore()
  const { run, error, setError } = useAction()
  const [tab, setTab] = useState('pending')
  const [create, setCreate] = useState(null)
  const [reject, setReject] = useState(null)
  const rows = state.adjustments.filter((a) => (tab === 'pending' ? a.status === 'Pending Approval' : tab === 'done' ? a.status !== 'Pending Approval' : true)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const pendingCounts = state.counts.filter((c) => c.status === 'Pending Review')
  const avail = create && create.productId && create.locationId ? d.at(create.productId, create.locationId) : null
  const save = () => {
    const r = run(A.createAdjustment, create, (n) => state.settings.requireAdjustmentApproval ? `${n} sent for approval` : `${n} applied`)
    if (r.ok) setCreate(null)
  }
  return (
    <div className="page">
      <PageHeader title="Stock adjustments" subtitle="Corrections to stock, with a reason. They change stock only after approval."
        actions={can('adjust.create') && <Button variant="primary" onClick={() => { setError(''); setCreate({ productId: '', locationId: '', type: 'decrease', qty: '', reason: ADJUST_REASONS[0], reference: '' }) }}>New adjustment</Button>} />
      {pendingCounts.length > 0 && <Notice tone="warn">{pendingCounts.length} stock count(s) waiting for review: {pendingCounts.map((c) => <Link key={c.id} to={'/counts/' + c.id} className="strong" style={{ marginRight: 8 }}>{c.number}</Link>)}</Notice>}
      {!create && !reject && <ErrorNotice error={error} />}
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'pending', label: `Waiting approval · ${state.adjustments.filter((a) => a.status === 'Pending Approval').length}` },
        { id: 'done', label: 'Completed & rejected' }, { id: 'all', label: 'All' },
      ]} />
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>Adjustment</TableHead><TableHead>Item & location</TableHead><TableHead className="right">Change</TableHead><TableHead className="right">Before → after</TableHead><TableHead>Reason</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((a) => {
                const p = d.products[a.productId]
                return (
                  <TableRow key={a.id}>
                    <TableCell className="strong">{a.number}{a.countId && <div className="sub">from count</div>}</TableCell>
                    <TableCell><Link to={'/products/' + p.id} style={{ color: 'inherit', textDecoration: 'none' }}>{p.name}</Link><div className="sub">{locationLabel(state, a.locationId)}</div></TableCell>
                    <TableCell className={'right ' + (a.type === 'increase' ? 'pos' : 'neg')}>{a.type === 'increase' ? '+' : '−'}{fmtQty(a.qty)}</TableCell>
                    <TableCell className="right muted nowrap">{a.status === 'Completed' ? `${fmtQty(a.before)} → ${fmtQty(a.after)}` : a.status === 'Pending Approval' ? `${fmtQty(d.at(a.productId, a.locationId))} now` : '—'}</TableCell>
                    <TableCell className="small">{a.reason}{a.reference && <div className="sub">{a.reference}</div>}{a.rejectReason && <div className="sub">Rejected: {a.rejectReason}</div>}</TableCell>
                    <TableCell className="small">{d.users[a.createdBy]?.name}<div className="sub">{fmtWhen(a.createdAt)}</div></TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell className="right nowrap">
                      {a.status === 'Pending Approval' && can('adjust.approve') && <>
                        <Button size="sm" variant="primary" onClick={() => run(A.approveAdjustment, { id: a.id }, `${a.number} approved — stock updated`)}>Approve</Button>{' '}
                        <Button size="sm" onClick={() => { setError(''); setReject({ id: a.id, number: a.number, reason: '' }) }}>Reject</Button>
                      </>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {!rows.length && <Empty title="Nothing here" />}
        </div>
      </Card>
      {create && (
        <Modal title="New stock adjustment" onClose={() => setCreate(null)}
          footer={<><Button onClick={() => setCreate(null)}>Cancel</Button><Button variant="primary" onClick={save}>{state.settings.requireAdjustmentApproval ? 'Send for approval' : 'Apply adjustment'}</Button></>}>
          <Field label="Item"><ProductSelect value={create.productId} onChange={(v) => setCreate({ ...create, productId: v })} /></Field>
          <Field label="Location"><LocationSelect value={create.locationId} onChange={(v) => setCreate({ ...create, locationId: v })} productId={create.productId || undefined} /></Field>
          <fieldset>
            <legend>Change</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <div className="flex flex-wrap gap-2">
                <Button className="rounded-full" variant={create.type === 'increase' ? 'primary' : undefined} aria-pressed={create.type === 'increase'} onClick={() => setCreate({ ...create, type: 'increase' })}>Increase</Button>
                <Button className="rounded-full" variant={create.type === 'decrease' ? 'primary' : undefined} aria-pressed={create.type === 'decrease'} onClick={() => setCreate({ ...create, type: 'decrease' })}>Decrease</Button>
              </div>
              <Input aria-label="Quantity" className="w-24 text-right" inputMode="decimal" value={create.qty} onChange={(e) => setCreate({ ...create, qty: e.target.value })} placeholder="Qty" />
              {avail != null && <span className="small muted">{fmtQty(avail)} there now{Number(create.qty) ? ` → ${fmtQty(avail + (create.type === 'increase' ? 1 : -1) * Number(create.qty))}` : ''}</span>}
            </div>
          </fieldset>
          <Field label="Reason">
            <NativeSelect className="w-full" value={create.reason} onChange={(e) => setCreate({ ...create, reason: e.target.value })}>
              {ADJUST_REASONS.map((r) => <NativeSelectOption key={r}>{r}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Reference / note" optional><Input value={create.reference} onChange={(e) => setCreate({ ...create, reference: e.target.value })} /></Field>
          <ErrorNotice error={error} />
        </Modal>
      )}
      {reject && (
        <Modal title={`Reject ${reject.number}?`} onClose={() => setReject(null)}
          footer={<><Button onClick={() => setReject(null)}>Cancel</Button><Button variant="primary" onClick={() => { const r = run(A.rejectAdjustment, reject, 'Adjustment rejected'); if (r.ok) setReject(null) }}>Reject</Button></>}>
          <p style={{ margin: 0 }}>Stock won't change. The request stays in the records as Rejected.</p>
          <Field label="Reason" optional><Input value={reject.reason} onChange={(e) => setReject({ ...reject, reason: e.target.value })} /></Field>
          <ErrorNotice error={error} />
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Reorder ---------------- */
export function Reorder() {
  const { state, d, can } = useStore()
  const { run, error } = useAction()
  const items = useMemo(() => state.products.filter((p) => p.active).map((p) => {
    const onHand = d.onHand(p.id)
    const inc = d.incoming.get(p.id) || 0
    return { p, onHand, inc, status: stockStatus(p, onHand), sug: suggestedQty(p, onHand, inc) }
  }).filter((x) => x.status !== 'ok').sort((a, b) => (a.status === b.status ? a.p.name.localeCompare(b.p.name) : a.status === 'out' ? -1 : 1)), [state, d])
  const [sel, setSel] = useState(() => Object.fromEntries(items.filter((x) => x.sug > 0).map((x) => [x.p.id, true])))
  const [qty, setQty] = useState(() => Object.fromEntries(items.map((x) => [x.p.id, String(x.sug)])))
  const [sup, setSup] = useState(() => Object.fromEntries(items.map((x) => [x.p.id, x.p.supplierId || ''])))
  const chosen = items.filter((x) => sel[x.p.id])
  const nSup = new Set(chosen.map((x) => sup[x.p.id]).filter(Boolean)).size
  const create = () => {
    const r = run(A.createDraftPOs, { lines: chosen.map((x) => ({ productId: x.p.id, qty: qty[x.p.id], supplierId: sup[x.p.id] })) }, (ids) => `${ids.length} draft order(s) created`)
    if (r.ok) navigate(r.result.length === 1 ? '/purchase-orders/' + r.result[0] : '/purchase-orders')
  }
  return (
    <div className="page">
      <PageHeader title="Reorder" subtitle="Items show here when stock drops to their reorder level. Tick what to buy and draft orders are prepared for you." />
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead><span className="sr-only">Select</span></TableHead><TableHead>Item</TableHead><TableHead className="right">On hand</TableHead><TableHead className="right">Reorder at</TableHead><TableHead className="right">Already ordered</TableHead><TableHead className="right">Order qty</TableHead><TableHead>Supplier</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((x) => (
                <TableRow key={x.p.id} className={sel[x.p.id] ? 'sel' : ''}>
                  <TableCell><Checkbox aria-label={`Select ${x.p.name}`} checked={!!sel[x.p.id]} disabled={!can('po.edit')} onCheckedChange={(v) => setSel({ ...sel, [x.p.id]: v === true })} /></TableCell>
                  <TableCell><Link to={'/products/' + x.p.id} className="strong" style={{ color: 'inherit', textDecoration: 'none' }}>{x.p.name}</Link><div style={{ marginTop: 4 }}><StockChip status={x.status} /></div></TableCell>
                  <TableCell className="right strong">{fmtQty(x.onHand)} <span className="muted" style={{ fontWeight: 400 }}>{x.p.uom}</span></TableCell>
                  <TableCell className="right muted">{x.p.reorderLevel}</TableCell>
                  <TableCell className="right inc">{x.inc ? fmtQty(x.inc) : '—'}{x.inc > 0 && x.sug === 0 && <div className="sub">covered</div>}</TableCell>
                  <TableCell className="right"><Input aria-label={`Order quantity for ${x.p.name}`} className="w-24 text-right" inputMode="decimal" value={qty[x.p.id]} onChange={(e) => setQty({ ...qty, [x.p.id]: e.target.value })} style={{ marginLeft: 'auto' }} disabled={!can('po.edit')} /></TableCell>
                  <TableCell>
                    <NativeSelect className="w-full" size="sm" aria-label={`Supplier for ${x.p.name}`} value={sup[x.p.id]} onChange={(e) => setSup({ ...sup, [x.p.id]: e.target.value })} disabled={!can('po.edit')}>
                      <NativeSelectOption value="">Choose…</NativeSelectOption>
                      {state.suppliers.filter((s) => s.active).map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                    </NativeSelect>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!items.length && <Empty title="Nothing to reorder">All items are above their reorder level.</Empty>}
        </div>
      </Card>
      <ErrorNotice error={error} />
      {items.length > 0 && can('po.edit') && (
        <div className="actionbar">
          <div><b>{chosen.length} items selected</b> <span className="muted">· {nSup} supplier{nSup === 1 ? '' : 's'}</span></div>
          <div className="actions">
            <Button onClick={() => setSel({})}>Clear</Button>
            <Button disabled={!chosen.length} onClick={create}>Create {Math.max(nSup, 1)} draft order{nSup === 1 ? '' : 's'}</Button>
          </div>
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>Draft orders don't change stock. Review and confirm them in Purchase orders before sending to the supplier.</p>
    </div>
  )
}
