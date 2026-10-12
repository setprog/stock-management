import { useMemo, useState } from 'react'
import { useStore, useAction } from '../data/store.jsx'
import { Link } from '../lib/router.jsx'
import { Button, Card, PageHeader, Field, ErrorNotice, Notice, ProductSelect, LocationSelect, Stepper, NoAccess, Empty } from '../components/ui.jsx'
import * as A from '../data/actions.js'
import { ISSUE_REASONS } from '../data/constants.js'
import { locationLabel } from '../data/selectors.js'
import { fmtQty, fmtWhen } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { FieldLegend } from '@/components/ui/field'

function BeforeAfter({ label, now, after, bad }) {
  return (
    <div className="stack-sm">
      <div className="small muted">{label}</div>
      <div className="ba" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ textAlign: 'center' }}><div className="small muted">Now</div><div style={{ fontSize: 28, fontWeight: 700 }}>{fmtQty(now)}</div></div>
        <Icon name="arrow" size={22} color="var(--muted-foreground)" />
        <div style={{ textAlign: 'center' }}><div className="small muted">After</div><div style={{ fontSize: 28, fontWeight: 700, color: bad ? 'var(--destructive)' : undefined }}>{bad ? '—' : fmtQty(after)}</div></div>
      </div>
    </div>
  )
}

function Recent({ title, rows }) {
  return (
    <Card title={title}>
      <div>
        <Table>
          <TableBody>
            {rows.map((r) => <TableRow key={r.key}>{r.cells.map((c, i) => <TableCell key={i} className={c.cls}>{c.v}</TableCell>)}</TableRow>)}
            {!rows.length && <TableRow><TableCell className="muted">Nothing yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

/* ---------------- Issue ---------------- */
export function Issue({ query }) {
  const { state, d, can } = useStore()
  const { run, error, setError } = useAction()
  const blank = { productId: query.product || '', locationId: '', qty: '1', reason: '', reference: '', note: '' }
  const [f, setF] = useState(blank)
  const p = d.products[f.productId]
  const avail = f.productId && f.locationId ? d.at(f.productId, f.locationId) : 0
  const q = Number(f.qty) || 0
  const tooMany = f.locationId && q > avail
  const set = (patch) => { setError(''); setF({ ...f, ...patch }) }
  // When an item is picked, preselect the location that holds the most of it.
  const pickProduct = (pid) => {
    const best = state.locations.map((l) => ({ id: l.id, q: d.at(pid, l.id) })).filter((x) => x.q > 0).sort((a, b) => b.q - a.q)[0]
    set({ productId: pid, locationId: best ? best.id : '' })
  }
  const submit = () => {
    const r = run(A.issueStock, f, (n) => `${n} completed — ${q} ${p.uom} issued`)
    if (r.ok) setF({ ...blank, productId: '' })
  }
  const recent = [...state.issues].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)
  if (!can('issue')) return <NoAccess />
  return (
    <div className="page">
      <PageHeader title="Issue stock" subtitle="Record stock that leaves — sold, used, damaged or lost. A reason is always needed." />
      <div className="row">
        <Card className="grow-2" pad>
          <div className="stack" style={{ gap: 22 }}>
            <div className="auto-grid-2">
              <Field label="Item"><ProductSelect value={f.productId} onChange={pickProduct} /></Field>
              <Field label="From location"><LocationSelect value={f.locationId} onChange={(v) => set({ locationId: v })} productId={f.productId || undefined} /></Field>
            </div>
            <fieldset>
              <FieldLegend variant="label">Quantity</FieldLegend>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <Stepper value={f.qty} onChange={(v) => set({ qty: v })} min={1} invalid={tooMany} />
                {p && f.locationId && <span className="small muted">{p.uom} · <b style={{ color: 'var(--foreground)' }}>{fmtQty(avail)}</b> available here</span>}
              </div>
              {tooMany && <Notice tone="bad" className="mt-2.5">You can issue at most {fmtQty(avail)} from this location.</Notice>}
            </fieldset>
            <fieldset>
              <FieldLegend variant="label">Why is it leaving?</FieldLegend>
              <div className="flex flex-wrap gap-2">
                {ISSUE_REASONS.map((r) => (
                  <Button key={r.id} className="rounded-full" variant={f.reason === r.id ? 'primary' : undefined} aria-pressed={f.reason === r.id} onClick={() => set({ reason: r.id })}>{r.label}</Button>
                ))}
              </div>
            </fieldset>
            <div className="auto-grid-2">
              <Field label="Reference" optional><Input value={f.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Invoice, job or request no." /></Field>
              <Field label="Note" optional={f.reason !== 'other'}><Input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder={f.reason === 'other' ? 'Explain the reason' : 'Anything worth remembering'} /></Field>
            </div>
          </div>
        </Card>
        <Card className="grow-1" title="What will happen">
          <div className="effect px-4 pb-4">
            {p && f.locationId ? <BeforeAfter label={`${p.name} at ${locationLabel(state, f.locationId)}`} now={avail} after={avail - q} bad={tooMany} />
              : <p className="muted small" style={{ margin: 0 }}>Choose an item and a location to see the effect.</p>}
            <div className="small">Reason: <b>{ISSUE_REASONS.find((r) => r.id === f.reason)?.label || 'not chosen yet'}</b></div>
            <ErrorNotice error={error} />
            <Button variant="primary" block disabled={!f.productId || !f.locationId || !f.reason || !q || tooMany} onClick={submit}>Confirm issue</Button>
            <Button block onClick={() => { setF(blank); setError('') }}>Clear</Button>
          </div>
        </Card>
      </div>
      <Recent title="Recently issued" rows={recent.map((r) => ({
        key: r.id, cells: [
          { v: r.number, cls: 'strong' }, { v: fmtWhen(r.at), cls: 'muted nowrap' }, { v: d.products[r.productId]?.name },
          { v: '−' + fmtQty(r.qty), cls: 'right neg' }, { v: locationLabel(state, r.locationId), cls: 'small' },
          { v: ISSUE_REASONS.find((x) => x.id === r.reason)?.label }, { v: d.users[r.userId]?.name, cls: 'muted' },
        ],
      }))} />
    </div>
  )
}

/* ---------------- Transfer ---------------- */
export function Transfer({ query }) {
  const { state, d, can } = useStore()
  const { run, error, setError } = useAction()
  const blank = { productId: query.product || '', fromLocationId: '', toLocationId: '', qty: '1', note: '' }
  const [f, setF] = useState(blank)
  const p = d.products[f.productId]
  const avail = f.productId && f.fromLocationId ? d.at(f.productId, f.fromLocationId) : 0
  const dest = f.productId && f.toLocationId ? d.at(f.productId, f.toLocationId) : 0
  const q = Number(f.qty) || 0
  const tooMany = f.fromLocationId && q > avail
  const set = (patch) => { setError(''); setF({ ...f, ...patch }) }
  const pickProduct = (pid) => {
    const best = state.locations.map((l) => ({ id: l.id, q: d.at(pid, l.id) })).filter((x) => x.q > 0).sort((a, b) => b.q - a.q)[0]
    set({ productId: pid, fromLocationId: best ? best.id : '' })
  }
  const submit = () => {
    const r = run(A.transferStock, f, (n) => `${n} completed — ${q} ${p.uom} moved`)
    if (r.ok) setF({ ...blank, productId: '' })
  }
  const recent = [...state.transfers].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)
  if (!can('transfer')) return <NoAccess />
  return (
    <div className="page">
      <PageHeader title="Transfer stock" subtitle="Move stock from one location to another. Your total stock stays the same." />
      <div className="row">
        <Card className="grow-2" pad>
          <div className="stack" style={{ gap: 22 }}>
            <Field label="Item"><ProductSelect value={f.productId} onChange={pickProduct} /></Field>
            <div className="auto-grid-2">
              <Field label="From"><LocationSelect value={f.fromLocationId} onChange={(v) => set({ fromLocationId: v })} productId={f.productId || undefined} /></Field>
              <Field label="To"><LocationSelect value={f.toLocationId} onChange={(v) => set({ toLocationId: v })} exclude={f.fromLocationId} productId={f.productId || undefined} /></Field>
            </div>
            <fieldset>
              <FieldLegend variant="label">Quantity</FieldLegend>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <Stepper value={f.qty} onChange={(v) => set({ qty: v })} min={1} invalid={tooMany} />
                {p && f.fromLocationId && <span className="small muted">{p.uom} · <b style={{ color: 'var(--foreground)' }}>{fmtQty(avail)}</b> available to move</span>}
              </div>
              {tooMany && <Notice tone="bad" className="mt-2.5">Only {fmtQty(avail)} at the source location.</Notice>}
            </fieldset>
            <Field label="Note" optional><Input value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
          </div>
        </Card>
        <Card className="grow-1" title="What will happen">
          <div className="effect px-4 pb-4">
            {p && f.fromLocationId ? <BeforeAfter label={`From ${locationLabel(state, f.fromLocationId)}`} now={avail} after={avail - q} bad={tooMany} /> : <p className="muted small" style={{ margin: 0 }}>Choose an item and locations to see the effect.</p>}
            {p && f.toLocationId && <BeforeAfter label={`To ${locationLabel(state, f.toLocationId)}`} now={dest} after={dest + q} bad={tooMany} />}
            {p && <div className="small muted">Total {p.name}: {fmtQty(d.onHand(p.id))} {p.uom} — unchanged.</div>}
            <ErrorNotice error={error} />
            <Button variant="primary" block disabled={!f.productId || !f.fromLocationId || !f.toLocationId || !q || tooMany} onClick={submit}>Confirm transfer</Button>
          </div>
        </Card>
      </div>
      <Recent title="Recent transfers" rows={recent.map((r) => ({
        key: r.id, cells: [
          { v: r.number, cls: 'strong' }, { v: fmtWhen(r.at), cls: 'muted nowrap' }, { v: d.products[r.productId]?.name },
          { v: fmtQty(r.qty), cls: 'right strong' }, { v: `${locationLabel(state, r.fromLocationId)} → ${locationLabel(state, r.toLocationId)}`, cls: 'small' }, { v: d.users[r.userId]?.name, cls: 'muted' },
        ],
      }))} />
    </div>
  )
}

/* ---------------- Opening stock ---------------- */
export function OpeningStock() {
  const { state, d, can } = useStore()
  const { run, error } = useAction()
  const empty = { productId: '', locationId: '', qty: '' }
  const [lines, setLines] = useState([empty, empty, empty])
  const done = useMemo(() => state.ledger.filter((e) => e.type === 'opening'), [state])
  if (!can('opening.enter')) return <NoAccess />
  const setLine = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const submit = () => {
    const r = run(A.enterOpeningStock, { lines }, (n) => `${n} saved — opening stock entered`)
    if (r.ok) setLines([empty, empty, empty])
  }
  return (
    <div className="page">
      <PageHeader title="Opening stock" subtitle="Enter what you already have on the shelves when you start using the system. Each line goes into the ledger as Opening stock." />
      <Notice>Use this once per item and location. Later corrections go through a <Link to="/adjustments">stock adjustment</Link> so they stay traceable.</Notice>
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead style={{ minWidth: 240 }}>Item</TableHead><TableHead style={{ minWidth: 220 }}>Location</TableHead><TableHead className="right">Quantity</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell><ProductSelect value={l.productId} onChange={(v) => setLine(i, { productId: v, locationId: l.locationId || d.products[v]?.defaultLocationId || '' })} size="sm" /></TableCell>
                  <TableCell><LocationSelect value={l.locationId} onChange={(v) => setLine(i, { locationId: v })} size="sm" /></TableCell>
                  <TableCell className="right"><Input aria-label="Quantity" className="w-24 text-right" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} style={{ marginLeft: 'auto' }} /> <span className="small muted">{d.products[l.productId]?.uom}</span></TableCell>
                  <TableCell className="right">{lines.length > 1 && <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Icon name="x" size={16} /></Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter><TableRow><TableCell colSpan={4}><Button variant="link" className="h-auto p-0" onClick={() => setLines([...lines, empty])}>+ Add another line</Button></TableCell></TableRow></TableFooter>
          </Table>
        </div>
      </Card>
      <ErrorNotice error={error} />
      <div className="actions"><Button variant="primary" onClick={submit}>Save opening stock</Button></div>
      <Card title={`Opening stock already entered · ${done.length}`}>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Location</TableHead><TableHead className="right">Qty</TableHead><TableHead>Reference</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
            <TableBody>
              {done.map((e) => <TableRow key={e.id}><TableCell>{d.products[e.productId]?.name}</TableCell><TableCell>{locationLabel(state, e.locationId)}</TableCell><TableCell className="right strong">{fmtQty(e.qty)}</TableCell><TableCell>{e.reference}</TableCell><TableCell className="muted">{fmtWhen(e.at)}</TableCell></TableRow>)}
            </TableBody>
          </Table>
          {!done.length && <Empty title="None yet" />}
        </div>
      </Card>
    </div>
  )
}
