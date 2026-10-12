// App-level building blocks. Each one is a thin wrapper over a shadcn/ui component (in ./ui/)
// so pages keep a short, consistent API.
import { Children, Fragment, cloneElement, isValidElement, useId } from 'react'
import Icon from './Icon.jsx'
import { Link } from '../lib/router.jsx'
import { STATUS_TONE, STOCK_STATUS, LEDGER_TYPES } from '../data/constants.js'
import { useStore } from '../data/store.jsx'
import { locationLabel } from '../data/selectors.js'
import { cn } from '@/lib/utils'
import { Button as UIButton } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card as UICard, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field as UIField, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Empty as UIEmpty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs as UITabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

export function PageHeader({ title, subtitle, crumbs, actions }) {
  return (
    <div className="flex flex-col gap-2">
      {crumbs && (
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                <BreadcrumbItem>
                  {c.to ? <BreadcrumbLink asChild><Link to={c.to}>{c.label}</Link></BreadcrumbLink> : <BreadcrumbPage>{c.label}</BreadcrumbPage>}
                </BreadcrumbItem>
                {i < crumbs.length - 1 && <BreadcrumbSeparator />}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </header>
    </div>
  )
}

// variant: primary | danger | ghost | link | secondary | (default: outline)
const VARIANT = { primary: 'default', danger: 'destructive', ghost: 'ghost', link: 'link', secondary: 'secondary' }
export function Button({ to, variant, size, block, className = '', children, ...rest }) {
  const props = {
    variant: VARIANT[variant] || 'outline',
    size: size === 'sm' ? 'sm' : size === 'icon' ? 'icon' : block ? 'lg' : 'default',
    className: cn(block && 'w-full', className),
  }
  if (to) return <UIButton asChild {...props}><Link to={to} {...rest}>{children}</Link></UIButton>
  return <UIButton type="button" {...props} {...rest}>{children}</UIButton>
}

const TONE = {
  ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  bad: 'bg-red-500/10 text-red-700 dark:text-red-400',
  info: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  accent: 'bg-primary/10 text-primary',
  neutral: '',
}
export function Chip({ tone = 'neutral', dot = true, className, children }) {
  return (
    <Badge variant="secondary" className={cn(TONE[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
      {children}
    </Badge>
  )
}
export function StatusChip({ status }) {
  return <Chip tone={STATUS_TONE[status] || 'neutral'}>{status}</Chip>
}
export function StockChip({ status }) {
  const s = STOCK_STATUS[status]
  return <Chip tone={s.tone}>{s.label}</Chip>
}
export function LedgerChip({ type }) {
  const t = LEDGER_TYPES[type] || { label: type, tone: 'neutral' }
  return <Chip tone={t.tone}>{t.label}</Chip>
}
export function ActiveChip({ active }) {
  return <Chip tone={active ? 'ok' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Chip>
}

export function Card({ title, actions, children, pad, className = '', ...rest }) {
  return (
    <UICard className={cn('gap-0 py-0', className)} {...rest}>
      {(title || actions) && (
        <CardHeader className="pt-4 pb-3">
          {title && <CardTitle className="font-semibold">{title}</CardTitle>}
          {actions && <CardAction className="row-span-1 self-center">{actions}</CardAction>}
        </CardHeader>
      )}
      {pad ? <CardContent className={cn('pb-4', !(title || actions) && 'pt-4')}>{children}</CardContent> : children}
    </UICard>
  )
}

// Labels its single control automatically (adds an id when the control has none).
export function Field({ label, optional, hint, error, children }) {
  const autoId = useId()
  const only = Children.count(children) === 1 && isValidElement(children) && children.type !== Fragment ? children : null
  const id = only ? only.props.id || autoId : undefined
  return (
    <UIField data-invalid={error ? 'true' : undefined} className="gap-1.5">
      <FieldLabel htmlFor={id} className="text-foreground">
        {label}{optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </FieldLabel>
      {only ? cloneElement(only, { id }) : children}
      {hint && !error && <FieldDescription className="text-xs">{hint}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </UIField>
  )
}

const NOTICE = {
  info: 'border-primary/20 bg-primary/5 text-primary *:data-[slot=alert-description]:text-foreground/80',
  ok: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 *:data-[slot=alert-description]:text-current',
  warn: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 *:data-[slot=alert-description]:text-current',
  bad: 'border-destructive/30 bg-destructive/5',
}
export function Notice({ tone, icon = 'info', children, className }) {
  return (
    <Alert variant={tone === 'bad' ? 'destructive' : 'default'} role={tone === 'bad' ? 'alert' : 'note'} className={cn('px-3.5 py-3', NOTICE[tone || 'info'], className)}>
      <Icon name={tone === 'bad' || tone === 'warn' ? 'alert' : icon} />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export function ErrorNotice({ error }) {
  if (!error) return null
  return <Notice tone="bad">{error}</Notice>
}

export function Empty({ title, children, action, icon = 'box' }) {
  return (
    <UIEmpty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-10 bg-primary/10 text-primary"><Icon name={icon} size={20} /></EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </UIEmpty>
  )
}

export function SearchBox({ value, onChange, placeholder, label = 'Search', className }) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon><Icon name="search" size={16} /></InputGroupAddon>
      <InputGroupInput type="search" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </InputGroup>
  )
}

export function Stepper({ value, onChange, min = 0, max, invalid, label = 'Quantity' }) {
  const n = Number(value) || 0
  return (
    <ButtonGroup>
      <UIButton type="button" variant="outline" size="icon-lg" aria-label="Decrease" onClick={() => onChange(String(Math.max(min, n - 1)))}>−</UIButton>
      <Input aria-label={label} inputMode="decimal" value={value} aria-invalid={invalid ? 'true' : 'false'} className="h-9 w-20 text-center text-base font-semibold"
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))} />
      <UIButton type="button" variant="outline" size="icon-lg" aria-label="Increase" onClick={() => onChange(String(max != null ? Math.min(max, n + 1) : n + 1))}>+</UIButton>
    </ButtonGroup>
  )
}

// Rendered conditionally by pages ({open && <Modal …/>}), so it is always open while mounted.
export function Modal({ title, onClose, children, footer }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <UITabs value={value} onValueChange={onChange} className="max-w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
      <TabsList>
        {tabs.map((t) => <TabsTrigger key={t.id} value={t.id} className="px-3">{t.label}</TabsTrigger>)}
      </TabsList>
    </UITabs>
  )
}

// Selects bound to store data
export function ProductSelect({ value, onChange, activeOnly = true, id, placeholder = 'Choose an item…', size, className }) {
  const { state } = useStore()
  const list = state.products.filter((p) => !activeOnly || p.active || p.id === value).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <NativeSelect id={id} size={size} className={cn('w-full', className)} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {list.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name} — {p.sku}</NativeSelectOption>)}
    </NativeSelect>
  )
}

export function LocationSelect({ value, onChange, activeOnly = true, warehouseId, placeholder = 'Choose a location…', productId, id, size, className, exclude }) {
  const { state, d } = useStore()
  const list = state.locations
    .filter((l) => (!activeOnly || (l.active && d.warehouses[l.warehouseId]?.active)) && (!warehouseId || l.warehouseId === warehouseId) && l.id !== exclude)
    .sort((a, b) => locationLabel(state, a.id).localeCompare(locationLabel(state, b.id)))
  return (
    <NativeSelect id={id} size={size} className={cn('w-full', className)} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {list.map((l) => (
        <NativeSelectOption key={l.id} value={l.id}>
          {locationLabel(state, l.id)}{productId ? ` — ${d.at(productId, l.id)} available` : ''}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

export function Steps({ steps, current }) {
  return (
    <ol className="steps" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'cur' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="n">{i < current ? <Icon name="tick" size={13} strokeWidth={3} /> : i + 1}</span>{s}
        </li>
      ))}
    </ol>
  )
}

export function NoAccess() {
  return (
    <div className="page narrow">
      <Card pad>
        <Empty title="You don't have access to this page" icon="shield">Ask an Admin to change your role if you need it.</Empty>
      </Card>
    </div>
  )
}
