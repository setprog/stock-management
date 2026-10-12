import { useMemo, useState } from 'react'
import { useStore, useAction } from '../data/store.jsx'
import { navigate } from '../lib/router.jsx'
import { Button, Card, PageHeader, SearchBox, ActiveChip, Field, ErrorNotice, Empty, LocationSelect, NoAccess, Notice } from '../components/ui.jsx'
import { saveProduct } from '../data/actions.js'
import { UOMS } from '../data/constants.js'
import { fmtMoney, fmtQty } from '../lib/format.js'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function Products() {
  const { state, d, can } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [st, setSt] = useState('active')
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return state.products
      .filter((p) => (st === 'all' ? true : st === 'active' ? p.active : !p.active))
      .filter((p) => !cat || p.categoryId === cat)
      .filter((p) => !s || [p.name, p.sku, p.barcode, p.brand].some((v) => v && v.toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [state, q, cat, st])
  const cur = state.settings.currency
  return (
    <div className="page">
      <PageHeader title="Products" subtitle="Everything you track as stock. Current stock is calculated from transactions, so it isn't edited here."
        actions={can('products.edit') && <Button to="/products/new" variant="primary">Add product</Button>} />
      <div className="filters">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, SKU, barcode or brand" />
        
          <NativeSelect aria-label="Category" className="w-full" value={cat} onChange={(e) => setCat(e.target.value)}>
            <NativeSelectOption value="">All categories</NativeSelectOption>
            {state.categories.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
          </NativeSelect>
        
          <NativeSelect aria-label="Status" className="w-full" value={st} onChange={(e) => setSt(e.target.value)}>
            <NativeSelectOption value="active">Active only</NativeSelectOption><NativeSelectOption value="inactive">Inactive only</NativeSelectOption><NativeSelectOption value="all">All</NativeSelectOption>
          </NativeSelect>
      </div>
      <Card>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead><TableHead className="right">On hand</TableHead><TableHead className="right">Reorder at</TableHead><TableHead className="right">Cost</TableHead><TableHead className="right">Price</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} className={'click' + (p.active ? '' : ' inactive')} onClick={() => navigate('/products/' + p.id)}>
                  <TableCell><span className="strong">{p.name}</span><div className="sub">{p.sku}{p.barcode ? ' · ' + p.barcode : ''}</div></TableCell>
                  <TableCell>{d.categories[p.categoryId]?.name}</TableCell>
                  <TableCell>{p.uom}</TableCell>
                  <TableCell className="right strong">{fmtQty(d.onHand(p.id))}</TableCell>
                  <TableCell className="right muted">{p.reorderLevel ?? '—'}</TableCell>
                  <TableCell className="right">{fmtMoney(p.cost, cur)}</TableCell>
                  <TableCell className="right">{fmtMoney(p.price, cur)}</TableCell>
                  <TableCell className="muted">{d.suppliers[p.supplierId]?.name || '—'}</TableCell>
                  <TableCell><ActiveChip active={p.active} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <Empty title="No products found" action={can('products.edit') && <Button to="/products/new" variant="primary">Add product</Button>} />}
        </div>
      </Card>
    </div>
  )
}

const blank = { sku: '', name: '', description: '', categoryId: '', brand: '', barcode: '', uom: 'pcs', minStock: '', reorderLevel: '', maxStock: '', supplierId: '', defaultLocationId: '', cost: '', price: '' }

export function ProductForm({ id }) {
  const { state, d, can } = useStore()
  const { run, error } = useAction()
  const existing = id ? d.products[id] : null
  const [f, setF] = useState(() => existing ? Object.fromEntries(Object.keys(blank).map((k) => [k, existing[k] ?? ''])) : blank)
  if (!can('products.edit')) return <NoAccess />
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e })

  const submit = (e) => {
    e.preventDefault()
    const r = run(saveProduct, { ...f, id }, id ? 'Product saved' : `${f.name} added`)
    if (r.ok) navigate('/products/' + r.result)
  }

  return (
    <div className="page narrow">
      <PageHeader crumbs={[{ label: 'Products', to: '/products' }, { label: id ? existing.name : 'New product' }]}
        title={id ? 'Edit product' : 'Add product'} subtitle="Fields marked optional can be filled in later." />
      {!id && <Notice>New items start with zero stock. Add stock by entering <b>opening stock</b> or <b>receiving</b> a delivery.</Notice>}
      <form onSubmit={submit} className="stack">
        <Card title="Basics" pad>
          <div className="auto-grid-2">
            <Field label="Item name"><Input  value={f.name} onChange={set('name')} placeholder="e.g. Nitrile Gloves (M)" /></Field>
            <Field label="SKU / item code" hint="Your own unique code"><Input  value={f.sku} onChange={set('sku')} placeholder="e.g. SAF-0112" /></Field>
            <Field label="Category">
              <NativeSelect className="w-full" value={f.categoryId} onChange={set('categoryId')}>
                <NativeSelectOption value="">Choose…</NativeSelectOption>
                {state.categories.filter((c) => c.active || c.id === f.categoryId).map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.parentId ? `${d.categories[c.parentId]?.name} › ` : ''}{c.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <Field label="Unit of measure" hint="How you count it">
              <Input  list="uoms" value={f.uom} onChange={set('uom')} />
              <datalist id="uoms">{UOMS.map((u) => <option key={u} value={u} />)}</datalist>
            </Field>
            <Field label="Brand / model" optional><Input  value={f.brand} onChange={set('brand')} /></Field>
            <Field label="Barcode" optional><Input  value={f.barcode} onChange={set('barcode')} /></Field>
          </div>
          <div style={{ marginTop: 16 }}>
            <Field label="Description" optional><Textarea value={f.description} onChange={set('description')} /></Field>
          </div>
        </Card>
        <Card title="Stock levels" pad>
          <div className="auto-grid-2">
            <Field label="Reorder level" optional hint="Marked Low stock at or below this"><Input  inputMode="decimal" value={f.reorderLevel} onChange={set('reorderLevel')} /></Field>
            <Field label="Maximum stock" optional hint="Used to suggest how much to reorder"><Input  inputMode="decimal" value={f.maxStock} onChange={set('maxStock')} /></Field>
            <Field label="Minimum stock" optional><Input  inputMode="decimal" value={f.minStock} onChange={set('minStock')} /></Field>
            <Field label="Default location" optional><LocationSelect value={f.defaultLocationId} onChange={set('defaultLocationId')} placeholder="None" /></Field>
          </div>
        </Card>
        <Card title="Buying and selling" pad>
          <div className="auto-grid-2">
            <Field label="Preferred supplier" optional>
              <NativeSelect className="w-full" value={f.supplierId} onChange={set('supplierId')}>
                <NativeSelectOption value="">None</NativeSelectOption>
                {state.suppliers.filter((s) => s.active || s.id === f.supplierId).map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <Field label={`Purchase cost (${state.settings.currency})`} optional><Input  inputMode="decimal" value={f.cost} onChange={set('cost')} /></Field>
            <Field label={`Selling price (${state.settings.currency})`} optional><Input  inputMode="decimal" value={f.price} onChange={set('price')} /></Field>
          </div>
        </Card>
        <ErrorNotice error={error} />
        <div className="actions">
          <Button type="submit"  variant="primary">{id ? 'Save changes' : 'Add product'}</Button>
          <Button to={id ? '/products/' + id : '/products'}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
