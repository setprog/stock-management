// Categories, Suppliers, Warehouses & locations, Users — simple list + modal edit screens.
import { useState } from 'react'
import { useStore, useAction } from '../data/store.jsx'
import { Link, navigate } from '../lib/router.jsx'
import { Button, Card, PageHeader, ActiveChip, Field, ErrorNotice, Empty, Modal, SearchBox, StatusChip, NoAccess } from '../components/ui.jsx'
import * as A from '../data/actions.js'
import { ROLES } from '../data/constants.js'
import { fmtDate, fmtMoney, fmtQty, initials } from '../lib/format.js'
import { poTotal } from '../data/selectors.js'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FieldLegend, FieldSet } from '@/components/ui/field'

/* ---------------- Categories ---------------- */
export function Categories() {
  const { state, d, can } = useStore()
  const { run, error, setError } = useAction()
  const [edit, setEdit] = useState(null)
  const editable = can('master.edit')
  const count = (id) => state.products.filter((p) => p.categoryId === id).length
  const sorted = [...state.categories].sort((a, b) => {
    const ka = (a.parentId ? d.categories[a.parentId]?.name + ' ' : '') + a.name
    const kb = (b.parentId ? d.categories[b.parentId]?.name + ' ' : '') + b.name
    return ka.localeCompare(kb)
  })
  const save = () => { const r = run(A.saveCategory, edit, 'Category saved'); if (r.ok) setEdit(null) }
  return (
    <div className="page narrow">
      <PageHeader title="Categories" subtitle="Group products so they're easy to find and report on."
        actions={editable && <Button variant="primary" onClick={() => { setError(''); setEdit({ name: '', parentId: '' }) }}>Add category</Button>} />
      {!edit && <ErrorNotice error={error} />}
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="right">Products</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {sorted.map((c) => (
              <TableRow key={c.id} className={c.active ? '' : 'inactive'}>
                <TableCell>{c.parentId && <span className="muted">{d.categories[c.parentId]?.name} › </span>}<span className="strong">{c.name}</span></TableCell>
                <TableCell className="right">{count(c.id)}</TableCell>
                <TableCell><ActiveChip active={c.active} /></TableCell>
                <TableCell className="right nowrap">
                  {editable && <>
                    <Button variant="ghost" size="sm" onClick={() => { setError(''); setEdit({ id: c.id, name: c.name, parentId: c.parentId || '' }) }}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => run(A.setCategoryActive, { id: c.id, active: !c.active }, c.active ? 'Category deactivated' : 'Category activated')}>{c.active ? 'Deactivate' : 'Activate'}</Button>
                    {count(c.id) === 0 && <Button variant="ghost" size="sm" onClick={() => run(A.deleteCategory, { id: c.id }, 'Category deleted')}>Delete</Button>}
                  </>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!state.categories.length && <Empty title="No categories yet">Start with broad groups like “Office” or “Spare parts”.</Empty>}
      </Card>
      <p className="small muted" style={{ margin: 0 }}>Categories used by products can't be deleted — deactivate them instead so history stays intact.</p>
      {edit && (
        <Modal title={edit.id ? 'Edit category' : 'Add category'} onClose={() => setEdit(null)}
          footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
          <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
          <Field label="Parent category" optional hint="Use this to make a sub-category">
            <NativeSelect className="w-full" value={edit.parentId} onChange={(e) => setEdit({ ...edit, parentId: e.target.value })}>
              <NativeSelectOption value="">None (top level)</NativeSelectOption>
              {state.categories.filter((c) => !c.parentId && c.id !== edit.id && c.active).map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <ErrorNotice error={error} />
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Suppliers ---------------- */
const blankSupplier = { name: '', contact: '', phone: '', email: '', address: '', terms: '', notes: '' }

function SupplierModal({ initial, onClose }) {
  const { run, error } = useAction()
  const [f, setF] = useState(initial)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = () => { const r = run(A.saveSupplier, f, 'Supplier saved'); if (r.ok) onClose(r.result) }
  return (
    <Modal title={f.id ? 'Edit supplier' : 'Add supplier'} onClose={() => onClose()}
      footer={<><Button onClick={() => onClose()}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <Field label="Supplier name"><Input value={f.name} onChange={set('name')} /></Field>
      <div className="auto-grid-2">
        <Field label="Contact person" optional><Input value={f.contact} onChange={set('contact')} /></Field>
        <Field label="Phone" optional><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Email" optional><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Payment terms" optional><Input value={f.terms} onChange={set('terms')} placeholder="e.g. Net 30" /></Field>
      </div>
      <Field label="Address" optional><Textarea value={f.address} onChange={set('address')} /></Field>
      <Field label="Notes" optional><Textarea value={f.notes} onChange={set('notes')} /></Field>
      <ErrorNotice error={error} />
    </Modal>
  )
}

export function Suppliers() {
  const { state, can } = useStore()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const cur = state.settings.currency
  const rows = state.suppliers.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
  const stats = (sid) => {
    const pos = state.purchaseOrders.filter((p) => p.supplierId === sid && p.status !== 'Cancelled' && p.status !== 'Draft')
    return { n: pos.length, total: pos.reduce((a, p) => a + poTotal(p), 0), last: pos.map((p) => p.orderDate).sort().pop() }
  }
  return (
    <div className="page">
      <PageHeader title="Suppliers" subtitle="Who you buy from."
        actions={can('suppliers.edit') && <Button variant="primary" onClick={() => setEdit(blankSupplier)}>Add supplier</Button>} />
      <div className="filters"><SearchBox value={q} onChange={setQ} placeholder="Search suppliers" /></div>
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Contact</TableHead><TableHead>Terms</TableHead><TableHead className="right">Orders</TableHead><TableHead className="right">Total purchased</TableHead><TableHead>Last order</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((s) => {
                const st = stats(s.id)
                return (
                  <TableRow key={s.id} className={'click' + (s.active ? '' : ' inactive')} onClick={() => navigate('/suppliers/' + s.id)}>
                    <TableCell className="strong">{s.name}</TableCell>
                    <TableCell>{s.contact || '—'}<div className="sub">{[s.phone, s.email].filter(Boolean).join(' · ')}</div></TableCell>
                    <TableCell className="muted">{s.terms || '—'}</TableCell>
                    <TableCell className="right">{st.n}</TableCell>
                    <TableCell className="right">{fmtMoney(Math.round(st.total), cur)}</TableCell>
                    <TableCell className="muted">{fmtDate(st.last)}</TableCell>
                    <TableCell><ActiveChip active={s.active} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {!rows.length && <Empty title="No suppliers yet" />}
        </div>
      </Card>
      {edit && <SupplierModal initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

export function SupplierDetail({ id }) {
  const { state, d, can } = useStore()
  const { run, error } = useAction()
  const [edit, setEdit] = useState(false)
  const s = d.suppliers[id]
  if (!s) return <div className="page"><Card pad><Empty title="Supplier not found" /></Card></div>
  const cur = state.settings.currency
  const pos = state.purchaseOrders.filter((p) => p.supplierId === id).sort((a, b) => b.orderDate.localeCompare(a.orderDate))
  const counted = pos.filter((p) => !['Cancelled', 'Draft'].includes(p.status))
  const products = state.products.filter((p) => p.supplierId === id || pos.some((po) => po.lines.some((l) => l.productId === p.id)))
  return (
    <div className="page">
      <PageHeader crumbs={[{ label: 'Suppliers', to: '/suppliers' }, { label: s.name }]} title={s.name}
        subtitle={[s.contact, s.phone, s.email, s.terms && 'Terms: ' + s.terms].filter(Boolean).join(' · ')}
        actions={can('suppliers.edit') && <>
          <Button onClick={() => setEdit(true)}>Edit</Button>
          <Button onClick={() => run(A.setSupplierActive, { id, active: !s.active }, s.active ? 'Supplier deactivated' : 'Supplier activated')}>{s.active ? 'Deactivate' : 'Activate'}</Button>
          {s.active && can('po.edit') && <Button variant="primary" to={'/purchase-orders/new?supplier=' + id}>New purchase order</Button>}
        </>} />
      <ErrorNotice error={error} />
      <section className="stats">
        <div className="stat"><div className="stat-label">Orders</div><div className="stat-value">{counted.length}</div></div>
        <div className="stat"><div className="stat-label">Total purchases</div><div className="stat-value">{fmtMoney(Math.round(counted.reduce((a, p) => a + poTotal(p), 0)), cur)}</div></div>
        <div className="stat"><div className="stat-label">Last purchase</div><div className="stat-value" style={{ fontSize: 20 }}>{fmtDate(counted[0]?.orderDate)}</div></div>
        <div className="stat"><div className="stat-label">Status</div><div className="stat-value"><ActiveChip active={s.active} /></div></div>
      </section>
      <div className="row">
        <Card className="grow-2" title="Purchase history">
          <div>
            <Table>
              <TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Date</TableHead><TableHead className="right">Lines</TableHead><TableHead className="right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {pos.map((p) => (
                  <TableRow key={p.id} className="click" onClick={() => navigate('/purchase-orders/' + p.id)}>
                    <TableCell className="strong">{p.number}</TableCell><TableCell>{fmtDate(p.orderDate)}</TableCell><TableCell className="right">{p.lines.length}</TableCell>
                    <TableCell className="right">{fmtMoney(poTotal(p), cur)}</TableCell><TableCell><StatusChip status={p.status} /></TableCell>
                  </TableRow>
                ))}
                {!pos.length && <TableRow><TableCell colSpan={5} className="muted">No orders yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </Card>
        <Card className="grow-1" title="Products supplied">
          <Table><TableBody>
            {products.map((p) => <TableRow key={p.id}><TableCell><Link to={'/products/' + p.id}>{p.name}</Link><div className="sub">{p.sku}</div></TableCell><TableCell className="right">{fmtQty(d.onHand(p.id))} {p.uom}</TableCell></TableRow>)}
            {!products.length && <TableRow><TableCell className="muted">None yet.</TableCell></TableRow>}
          </TableBody></Table>
        </Card>
      </div>
      {(s.address || s.notes) && <Card pad title="Notes">{s.address && <p style={{ marginTop: 0, whiteSpace: 'pre-line' }}>{s.address}</p>}{s.notes && <p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{s.notes}</p>}</Card>}
      {edit && <SupplierModal initial={{ ...blankSupplier, ...s }} onClose={() => setEdit(false)} />}
    </div>
  )
}

/* ---------------- Warehouses & locations ---------------- */
export function Locations() {
  const { state, d, can } = useStore()
  const { run, error, setError } = useAction()
  const [edit, setEdit] = useState(null) // { kind: 'wh'|'loc', ... }
  const editable = can('master.edit')
  const qtyAt = (lid) => state.products.reduce((a, p) => a + d.at(p.id, lid), 0)
  const save = () => {
    const r = edit.kind === 'wh' ? run(A.saveWarehouse, edit, 'Warehouse saved') : run(A.saveLocation, edit, 'Location saved')
    if (r.ok) setEdit(null)
  }
  const open = (x) => { setError(''); setEdit(x) }
  return (
    <div className="page narrow">
      <PageHeader title="Warehouses & locations" subtitle="Where stock is physically kept: Warehouse → Location (rack, shelf, bin)."
        actions={editable && <Button variant="primary" onClick={() => open({ kind: 'wh', name: '', address: '' })}>Add warehouse</Button>} />
      {!edit && <ErrorNotice error={error} />}
      {state.warehouses.map((w) => {
        const locs = state.locations.filter((l) => l.warehouseId === w.id).sort((a, b) => a.name.localeCompare(b.name))
        return (
          <Card key={w.id} title={<span>{w.name} {!w.active && <ActiveChip active={false} />}</span>}
            actions={editable && <div className="actions">
              <Button variant="ghost" size="sm" onClick={() => open({ kind: 'wh', id: w.id, name: w.name, address: w.address || '' })}>Rename</Button>
              <Button variant="ghost" size="sm" onClick={() => run(A.setWarehouseActive, { id: w.id, active: !w.active }, w.active ? 'Warehouse deactivated' : 'Warehouse activated')}>{w.active ? 'Deactivate' : 'Activate'}</Button>
              {w.active && <Button size="sm" onClick={() => open({ kind: 'loc', warehouseId: w.id, name: '' })}>Add location</Button>}
            </div>}>
            <Table>
              <TableHeader><TableRow><TableHead>Location</TableHead><TableHead className="right">Units stored</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {locs.map((l) => (
                  <TableRow key={l.id} className={l.active ? '' : 'inactive'}>
                    <TableCell className="strong">{l.name}</TableCell>
                    <TableCell className="right">{fmtQty(qtyAt(l.id))}</TableCell>
                    <TableCell><ActiveChip active={l.active} /></TableCell>
                    <TableCell className="right nowrap">{editable && <>
                      <Button variant="ghost" size="sm" onClick={() => open({ kind: 'loc', id: l.id, warehouseId: w.id, name: l.name })}>Rename</Button>
                      <Button variant="ghost" size="sm" onClick={() => run(A.setLocationActive, { id: l.id, active: !l.active }, l.active ? 'Location deactivated' : 'Location activated')}>{l.active ? 'Deactivate' : 'Activate'}</Button>
                    </>}</TableCell>
                  </TableRow>
                ))}
                {!locs.length && <TableRow><TableCell colSpan={4} className="muted">No locations yet. Add racks, shelves or bins.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        )
      })}
      {!state.warehouses.length && <Card pad><Empty title="No warehouses yet">Add your first warehouse, then the locations inside it.</Empty></Card>}
      {edit && (
        <Modal title={edit.kind === 'wh' ? (edit.id ? 'Rename warehouse' : 'Add warehouse') : (edit.id ? 'Rename location' : `Add location to ${d.warehouses[edit.warehouseId]?.name}`)}
          onClose={() => setEdit(null)} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
          <Field label={edit.kind === 'wh' ? 'Warehouse name' : 'Location name'} hint={edit.kind === 'loc' ? 'e.g. Rack A03, Shelf B01, Bin 7' : undefined}>
            <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
          </Field>
          {edit.kind === 'wh' && <Field label="Address" optional><Input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>}
          <ErrorNotice error={error} />
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Users & roles ---------------- */
export function Users() {
  const { state, user, can } = useStore()
  const { run, error, setError } = useAction()
  const [edit, setEdit] = useState(null)
  if (!can('users.manage')) return <NoAccess />
  const save = () => { const r = run(A.saveUser, edit, 'User saved'); if (r.ok) setEdit(null) }
  return (
    <div className="page narrow">
      <PageHeader title="Users & roles" subtitle="Each person's role decides what they can do."
        actions={<Button variant="primary" onClick={() => { setError(''); setEdit({ name: '', email: '', role: 'storekeeper' }) }}>Add user</Button>} />
      {!edit && <ErrorNotice error={error} />}
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {state.users.map((u) => (
              <TableRow key={u.id} className={u.active ? '' : 'inactive'}>
                <TableCell><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="avatar">{initials(u.name)}</span><span><span className="strong">{u.name}</span>{u.id === user.id && <span className="muted small"> (you)</span>}<div className="sub">{u.email}</div></span></div></TableCell>
                <TableCell>{ROLES[u.role].label}</TableCell>
                <TableCell><ActiveChip active={u.active} /></TableCell>
                <TableCell className="right nowrap">
                  <Button variant="ghost" size="sm" onClick={() => { setError(''); setEdit({ id: u.id, name: u.name, email: u.email || '', role: u.role }) }}>Edit</Button>
                  {u.id !== user.id && <Button variant="ghost" size="sm" onClick={() => run(A.setUserActive, { id: u.id, active: !u.active }, u.active ? 'User deactivated' : 'User activated')}>{u.active ? 'Deactivate' : 'Activate'}</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card title="What each role can do" pad>
        <div className="stack-sm">
          {Object.entries(ROLES).map(([k, r]) => <div key={k}><span className="strong">{r.label}</span> <span className="muted">— {r.blurb}</span></div>)}
        </div>
      </Card>
      {edit && (
        <Modal title={edit.id ? 'Edit user' : 'Add user'} onClose={() => setEdit(null)} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
          <Field label="Full name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Email" optional><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
          <FieldSet>
            <FieldLegend variant="label">Role</FieldLegend>
            <RadioGroup value={edit.role} onValueChange={(k) => setEdit({ ...edit, role: k })}>
              {Object.entries(ROLES).map(([k, r]) => (
                <Label key={k} className="items-start rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5">
                  <RadioGroupItem value={k} className="mt-0.5" />
                  <span><span className="strong">{r.label}</span> <span className="muted">— {r.blurb}</span></span>
                </Label>
              ))}
            </RadioGroup>
          </FieldSet>
          <ErrorNotice error={error} />
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Settings ---------------- */
export function Settings() {
  const { state, can, reset } = useStore()
  const { run, error } = useAction()
  const [f, setF] = useState(state.settings)
  const [confirm, setConfirm] = useState(null)
  if (!can('users.manage')) return <NoAccess />
  return (
    <div className="page narrow">
      <PageHeader title="Settings" subtitle="Organization details and rules." />
      <Card title="Organization" pad>
        <div className="auto-grid-2">
          <Field label="Company name" optional><Input value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} /></Field>
          <Field label="Currency symbol"><Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} style={{ maxWidth: 120 }} /></Field>
        </div>
      </Card>
      <Card title="Rules" pad>
        <div className="stack">
          <Label className="font-normal"><Checkbox checked={f.requireAdjustmentApproval} onCheckedChange={(v) => setF({ ...f, requireAdjustmentApproval: v === true })} /> Adjustments need approval before they change stock</Label>
          <Label className="font-normal"><Checkbox checked={f.separateApprover} onCheckedChange={(v) => setF({ ...f, separateApprover: v === true })} /> The person who requests an adjustment can't approve it</Label>
          <Label className="font-normal"><Checkbox checked={f.allowOverReceive} onCheckedChange={(v) => setF({ ...f, allowOverReceive: v === true })} /> Allow receiving more than was ordered</Label>
        </div>
      </Card>
      <ErrorNotice error={error} />
      <div className="actions"><Button variant="primary" onClick={() => run(A.saveSettings, f, 'Settings saved')}>Save settings</Button></div>
      <Card title="Data" pad>
        <p className="muted" style={{ marginTop: 0 }}>Data is stored in this browser. You can start fresh or reload the demo data.</p>
        <div className="actions">
          <Button onClick={() => setConfirm('demo')}>Reload demo data</Button>
          <Button variant="danger" onClick={() => setConfirm('empty')}>Start with an empty system</Button>
        </div>
      </Card>
      {confirm && (
        <Modal title="Replace all data?" onClose={() => setConfirm(null)}
          footer={<><Button onClick={() => setConfirm(null)}>Keep my data</Button><Button variant="primary" onClick={() => { reset(confirm); setConfirm(null); navigate(confirm === 'empty' ? '/setup' : '/') }}>Yes, replace everything</Button></>}>
          <p style={{ margin: 0 }}>This removes every product, order, movement and log entry in this browser{confirm === 'demo' ? ' and loads the demo data' : ' and keeps only your user'}. This can't be undone.</p>
        </Modal>
      )}
    </div>
  )
}
