import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis } from 'recharts'
import { useStore } from '../data/store.jsx'
import { Link } from '../lib/router.jsx'
import { Button, LedgerChip, Chip, Notice } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { stockStatus, OPEN_PO, locationLabel, setupProgress } from '../data/selectors.js'
import { fmtMoney, fmtQty, fmtWhen, initials } from '../lib/format.js'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const QUICK = [
  { to: '/receive', t: 'Receive stock', dsc: 'Goods arrived from a supplier', icon: 'in', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', perm: 'receive' },
  { to: '/issue', t: 'Issue stock', dsc: 'Sold, used, damaged or lost', icon: 'out', tone: 'bg-red-500/10 text-red-600 dark:text-red-400', perm: 'issue' },
  { to: '/transfer', t: 'Transfer stock', dsc: 'Move between locations', icon: 'transfer', tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', perm: 'transfer' },
  { to: '/purchase-orders/new', t: 'Create purchase order', dsc: 'Order from a supplier', icon: 'cart', tone: 'bg-primary/10 text-primary', perm: 'po.edit' },
  { to: '/counts', t: 'Start stock count', dsc: 'Check shelves against the system', icon: 'clipboard', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', perm: 'count.do' },
  { to: '/products/new', t: 'Add product', dsc: 'A new item to track', icon: 'plus', tone: 'bg-muted text-muted-foreground', perm: 'products.edit' },
]

const DAYS = 14
const dayKey = (t) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).toDateString()

const movementConfig = {
  in: { label: 'Received', color: 'var(--chart-1)' },
  out: { label: 'Issued', color: 'var(--chart-2)' },
}
const healthConfig = {
  ok: { label: 'In stock', color: 'var(--chart-3)' },
  low: { label: 'Low stock', color: 'var(--chart-4)' },
  out: { label: 'Out of stock', color: 'var(--chart-5)' },
}

function Kpi({ label, value, unit, icon, foot, highlight }) {
  return (
    <Card className={highlight ? 'bg-linear-to-br from-primary to-indigo-500 text-primary-foreground shadow-lg ring-0 shadow-primary/20' : 'bg-linear-to-t from-primary/5 to-card shadow-xs'}>
      <CardHeader>
        <CardDescription className={highlight ? 'text-primary-foreground/80' : undefined}>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums @[250px]/card:text-3xl">
          {value}{unit && <span className={'ml-1 text-sm font-normal ' + (highlight ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{unit}</span>}
        </CardTitle>
        <CardAction>
          <span className={'flex size-9 items-center justify-center rounded-lg ' + (highlight ? 'bg-white/15' : 'bg-primary/10 text-primary')}><Icon name={icon} size={18} /></span>
        </CardAction>
      </CardHeader>
      <CardFooter className={'border-0 bg-transparent pt-0 text-xs ' + (highlight ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{foot}</CardFooter>
    </Card>
  )
}

const ATTN_TONE = {
  warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  bad: 'bg-red-500/10 text-red-600 dark:text-red-400',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  neutral: 'bg-muted text-muted-foreground',
}
function Attention({ tone, label, count, unit, text, to, cta, icon }) {
  return (
    <Card className="gap-3 shadow-xs transition-shadow hover:shadow-md">
      <CardHeader>
        <CardDescription><Chip tone={tone}>{label}</Chip></CardDescription>
        <CardAction><span className={'flex size-8 items-center justify-center rounded-lg ' + ATTN_TONE[tone]}><Icon name={icon} size={16} /></span></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="text-3xl font-semibold tracking-tight tabular-nums">{count} <span className="text-sm font-normal text-muted-foreground">{unit}</span></div>
        <p className="m-0 text-xs text-muted-foreground">{text}</p>
      </CardContent>
      <CardFooter className="mt-auto border-0 bg-transparent py-0">
        <Button to={to} variant="link" className="h-auto p-0">{cta} <Icon name="arrow" size={14} /></Button>
      </CardFooter>
    </Card>
  )
}

export default function Dashboard() {
  const { state, d, can, user } = useStore()
  const cur = state.settings.currency

  const m = useMemo(() => {
    const active = state.products.filter((p) => p.active)
    let units = 0, value = 0, low = 0, out = 0
    for (const p of active) {
      const q = d.onHand(p.id)
      units += q
      value += q * (p.cost || 0)
      const s = stockStatus(p, q)
      if (s === 'low') low++
      if (s === 'out') out++
    }
    const openPOs = state.purchaseOrders.filter((p) => OPEN_PO.includes(p.status))
    const incoming = [...d.incoming.values()].reduce((a, b) => a + b, 0)
    const pendingApprovals = state.adjustments.filter((a) => a.status === 'Pending Approval').length + state.counts.filter((c) => c.status === 'Pending Review').length
    const byWh = state.warehouses.filter((w) => w.active).map((w) => {
      let q = 0
      for (const l of state.locations) if (l.warehouseId === w.id) for (const p of state.products) q += d.at(p.id, l.id)
      return { id: w.id, name: w.name, q }
    })
    const recent = [...state.ledger].sort((a, b) => b.at.localeCompare(a.at)).filter((e) => e.type !== 'transfer_in').slice(0, 7)

    // Daily units in vs out (transfers excluded — they don't change the total)
    const now = new Date()
    const days = Array.from({ length: DAYS }, (_, i) => {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1 - i))
      return { key: dayKey(t), label: t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), in: 0, out: 0 }
    })
    const idx = new Map(days.map((x, i) => [x.key, i]))
    for (const e of state.ledger) {
      if (e.type === 'transfer_in' || e.type === 'transfer_out') continue
      const i = idx.get(dayKey(new Date(e.at)))
      if (i == null) continue
      if (e.qty > 0) days[i].in += e.qty
      else days[i].out += -e.qty
    }
    const movedIn = days.reduce((a, x) => a + x.in, 0)
    const movedOut = days.reduce((a, x) => a + x.out, 0)

    return { count: active.length, units, value, low, out, ok: active.length - low - out, openPOs, incoming, pendingApprovals, byWh, recent, days, movedIn, movedOut, drafts: state.purchaseOrders.filter((p) => p.status === 'Draft').length }
  }, [state, d])

  const maxWh = Math.max(1, ...m.byWh.map((w) => w.q))
  const setup = setupProgress(state)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const health = [
    { key: 'ok', n: m.ok, fill: 'var(--color-ok)' },
    { key: 'low', n: m.low, fill: 'var(--color-low)' },
    { key: 'out', n: m.out, fill: 'var(--color-out)' },
  ]
  const healthy = m.count ? Math.round((m.ok / m.count) * 100) : 0

  return (
    <div className="page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greet}, {user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's what's happening with your stock today.</p>
        </div>
        <div className="actions">
          <Button to="/inventory"><Icon name="layers" size={16} /> View inventory</Button>
          {can('receive') && <Button to="/receive" variant="primary"><Icon name="in" size={16} /> Receive stock</Button>}
        </div>
      </header>

      {!setup.ready && user.role === 'admin' && (
        <Notice>
          Setup is {setup.done} of {setup.steps.length} steps done. <Link to="/setup" className="font-medium text-primary underline-offset-4 hover:underline">Finish setting up →</Link>
        </Notice>
      )}

      <section aria-label="Totals" className="grid gap-4 *:data-[slot=card]:@container/card sm:grid-cols-2 xl:grid-cols-4">
        <Kpi highlight label="Stock value (at cost)" value={fmtMoney(Math.round(m.value), cur)} icon="wallet" foot="Across all active warehouses" />
        <Kpi label="Products" value={fmtQty(m.count)} icon="tag" foot="Active items being tracked" />
        <Kpi label="Units in stock" value={fmtQty(m.units)} icon="box"
          foot={<span><span className="pos">+{fmtQty(m.movedIn)}</span> in · <span className="neg">−{fmtQty(m.movedOut)}</span> out in the last {DAYS} days</span>} />
        <Kpi label="Incoming (on order)" value={fmtQty(m.incoming)} unit="units" icon="truck" foot={`${m.openPOs.length} open purchase orders`} />
      </section>

      <section aria-labelledby="att" className="flex flex-col gap-3">
        <h2 id="att" className="section-title">Needs your attention</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Attention tone="warn" label="Low stock" count={m.low} unit="items" text="At or below their reorder level" to="/reorder" cta="Review and reorder" icon="alert" />
          <Attention tone="bad" label="Out of stock" count={m.out} unit="items" text="Nothing left in any location" to="/inventory?status=out" cta="See items" icon="x" />
          <Attention tone="info" label="On order" count={m.openPOs.length} unit="orders" text={`Waiting to be received${m.drafts ? ` · ${m.drafts} draft` : ''}`} to="/receive" cta="Receive a delivery" icon="truck" />
          <Attention tone="neutral" label="Waiting approval" count={m.pendingApprovals} unit="tasks" text="Counts and adjustments to review" to="/adjustments" cta="Review" icon="clipboard" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-xs lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-semibold">Stock movement</CardTitle>
            <CardDescription>Units received vs. issued, last {DAYS} days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={movementConfig} className="aspect-auto h-60 w-full">
              <BarChart data={m.days} margin={{ left: 0, right: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="in" fill="var(--color-in)" radius={4} isAnimationActive={false} />
                <Bar dataKey="out" fill="var(--color-out)" radius={4} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="font-semibold">Stock health</CardTitle>
            <CardDescription>Active products by status</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-4">
            <ChartContainer config={healthConfig} className="aspect-square h-44">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
                <Pie data={health} dataKey="n" nameKey="key" innerRadius={56} strokeWidth={4} isAnimationActive={false}>
                  {health.map((h) => <Cell key={h.key} fill={h.fill} />)}
                  <Label content={({ viewBox }) => (viewBox && 'cx' in viewBox ? (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">{healthy}%</tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">healthy</tspan>
                    </text>
                  ) : null)} />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="grid w-full gap-2 text-sm">
              {health.map((h) => (
                <div key={h.key} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: healthConfig[h.key].color }} />
                  {healthConfig[h.key].label}
                  <span className="ml-auto font-semibold tabular-nums">{h.n}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {QUICK.some((q) => can(q.perm)) && (
        <section aria-labelledby="qa" className="flex flex-col gap-3">
          <h2 id="qa" className="section-title">Quick actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {QUICK.filter((q) => can(q.perm)).map((q) => (
              <Link key={q.to} to={q.to} className="group flex items-center gap-3.5 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/30">
                <span className={'flex size-10 shrink-0 items-center justify-center rounded-lg ' + q.tone}><Icon name={q.icon} size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{q.t}</span>
                  <span className="block text-xs text-muted-foreground">{q.dsc}</span>
                </span>
                <Icon name="arrow" size={16} className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-0 pb-0 shadow-xs lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-semibold">Recent stock movements</CardTitle>
            <CardDescription>The latest changes across all locations</CardDescription>
            <CardAction><Button to="/ledger" variant="ghost" size="sm">View ledger <Icon name="arrow" size={14} /></Button></CardAction>
          </CardHeader>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Location</TableHead><TableHead>When</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {m.recent.map((e) => {
                const p = d.products[e.productId]
                const isTr = e.type === 'transfer_out'
                const pair = isTr && state.ledger.find((x) => x.type === 'transfer_in' && x.reference === e.reference)
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link to={'/products/' + p.id} className="flex items-center gap-2.5">
                        <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">{initials(p.name)}</AvatarFallback></Avatar>
                        <span><span className="block font-medium">{p.name}</span><span className="block text-xs text-muted-foreground">{p.sku}</span></span>
                      </Link>
                    </TableCell>
                    <TableCell>{isTr ? <Chip tone="info">Transfer</Chip> : <LedgerChip type={e.type} />}</TableCell>
                    <TableCell className={'text-right ' + (isTr ? 'font-semibold' : e.qty > 0 ? 'pos' : 'neg')}>{isTr ? fmtQty(-e.qty) : (e.qty > 0 ? '+' : '−') + fmtQty(Math.abs(e.qty))}</TableCell>
                    <TableCell className="text-muted-foreground">{isTr && pair ? `${locationLabel(state, e.locationId)} → ${d.locations[pair.locationId]?.name}` : locationLabel(state, e.locationId)}</TableCell>
                    <TableCell>{fmtWhen(e.at)}<span className="block text-xs text-muted-foreground">{d.users[e.userId]?.name}</span></TableCell>
                  </TableRow>
                )
              })}
              {!m.recent.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No movements yet. Enter opening stock or receive a delivery to begin.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>

        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="font-semibold">Stock by warehouse</CardTitle>
            <CardDescription>Units on hand</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {m.byWh.map((w) => (
              <div key={w.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name="warehouse" size={16} /></span>
                  <span className="font-medium">{w.name}</span>
                  <span className="ml-auto font-semibold tabular-nums">{fmtQty(w.q)}</span>
                </div>
                <Progress value={(w.q / maxWh) * 100} aria-label={`${w.name}: ${fmtQty(w.q)} units`} />
              </div>
            ))}
            {!m.byWh.length && <p className="m-0 text-sm text-muted-foreground">No warehouses yet.</p>}
            <p className="m-0 text-xs text-muted-foreground">Transfers move stock between warehouses without changing the total.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
