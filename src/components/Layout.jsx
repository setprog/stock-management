import { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Link, navigate } from '../lib/router.jsx'
import { useStore } from '../data/store.jsx'
import { ROLES } from '../data/constants.js'
import { stockStatus } from '../data/selectors.js'
import { initials } from '../lib/format.js'
import { useTheme } from '../lib/theme.js'
import Icon from './Icon.jsx'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'

export const NAV = [
  { items: [
    { to: '/', icon: 'home', label: 'Dashboard' },
    { to: '/inventory', icon: 'layers', label: 'Inventory' },
  ] },
  { label: 'Daily work', items: [
    { to: '/receive', icon: 'in', label: 'Receive stock' },
    { to: '/issue', icon: 'out', label: 'Issue stock' },
    { to: '/transfer', icon: 'transfer', label: 'Transfer stock' },
    { to: '/counts', icon: 'clipboard', label: 'Stock counts' },
    { to: '/adjustments', icon: 'sliders', label: 'Adjustments', badge: 'adjust' },
  ] },
  { label: 'Buying', items: [
    { to: '/purchase-orders', icon: 'cart', label: 'Purchase orders' },
    { to: '/reorder', icon: 'refresh', label: 'Reorder', badge: 'low' },
    { to: '/suppliers', icon: 'truck', label: 'Suppliers' },
  ] },
  { label: 'Records', items: [
    { to: '/ledger', icon: 'book', label: 'Stock ledger' },
    { to: '/reports', icon: 'chart', label: 'Reports', perm: 'reports.view' },
    { to: '/audit', icon: 'shield', label: 'Audit log', perm: 'audit.view' },
  ] },
  { label: 'Setup', items: [
    { to: '/products', icon: 'tag', label: 'Products' },
    { to: '/categories', icon: 'folder', label: 'Categories' },
    { to: '/locations', icon: 'warehouse', label: 'Warehouses & locations' },
    { to: '/opening-stock', icon: 'flag', label: 'Opening stock', perm: 'opening.enter' },
    { to: '/users', icon: 'users', label: 'Users & roles', perm: 'users.manage' },
    { to: '/settings', icon: 'settings', label: 'Settings', perm: 'users.manage' },
  ] },
]

function isActive(to, path) {
  if (to === '/') return path === '/'
  return path === to || path.startsWith(to + '/')
}

function AppSidebar({ path, badges }) {
  const { state, user, can, signIn } = useStore()
  const { setOpenMobile } = useSidebar()
  const { theme, toggle } = useTheme()
  const close = () => setOpenMobile(false)

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" onClick={close}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon name="box" size={16} />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">{state.settings.companyName || 'Stock Manager'}</span>
                  <span className="truncate text-xs text-muted-foreground">Inventory control</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((g, i) => {
          const items = g.items.filter((it) => !it.perm || can(it.perm))
          if (!items.length) return null
          return (
            <SidebarGroup key={i} className="py-1">
              {g.label && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
              <SidebarMenu>
                {items.map((it) => (
                  <SidebarMenuItem key={it.to}>
                    <SidebarMenuButton asChild isActive={isActive(it.to, path)} tooltip={it.label}>
                      <Link to={it.to} onClick={close} aria-current={isActive(it.to, path) ? 'page' : undefined}>
                        <Icon name={it.icon} size={16} />
                        <span>{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {it.badge && badges[it.badge] > 0 && (
                      <SidebarMenuBadge className={it.badge === 'low' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-muted'}>
                        {badges[it.badge]}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 font-semibold text-primary">{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{ROLES[user.role].label}</span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="font-medium text-foreground">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{ROLES[user.role].blurb}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={toggle}>
                  <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} /> {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => signIn(null)}>
                  <Icon name="logout" size={16} /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function GlobalSearch() {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const prods = state.products.filter((p) => [p.name, p.sku, p.barcode].some((v) => v && v.toLowerCase().includes(s))).slice(0, 6)
      .map((p) => ({ to: '/products/' + p.id, label: p.name, sub: p.sku, icon: 'tag' }))
    const pos = state.purchaseOrders.filter((p) => p.number.toLowerCase().includes(s)).slice(0, 3)
      .map((p) => ({ to: '/purchase-orders/' + p.id, label: p.number, sub: 'Purchase order · ' + p.status, icon: 'cart' }))
    return [...prods, ...pos]
  }, [q, state])

  return (
    <div className="relative w-full max-w-md">
      <InputGroup className="bg-background">
        <InputGroupAddon><Icon name="search" size={16} /></InputGroupAddon>
        <InputGroupInput type="search" aria-label="Search items or orders" value={q} placeholder="Search item, SKU, barcode or PO number"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { navigate(results[0].to); setQ('') } }} />
        {results.length > 0 && <InputGroupAddon align="inline-end"><Kbd>Enter</Kbd></InputGroupAddon>}
      </InputGroup>
      {results.length > 0 && (
        <div className="absolute inset-x-0 top-10 z-50 rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95">
          {results.map((r) => (
            <Link key={r.to} to={r.to} onClick={() => setQ('')} className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
              <Icon name={r.icon} size={16} className="text-muted-foreground" />
              <span className="min-w-0"><span className="block truncate font-medium">{r.label}</span><span className="block truncate text-xs text-muted-foreground">{r.sub}</span></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout({ path, children }) {
  const { state, d } = useStore()
  const { theme, toggle } = useTheme()

  const badges = useMemo(() => ({
    low: state.products.filter((p) => p.active && stockStatus(p, d.onHand(p.id)) !== 'ok').length,
    adjust: state.adjustments.filter((a) => a.status === 'Pending Approval').length,
  }), [state, d])

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar path={path} badges={badges} />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
              </Button>
              <Button variant="ghost" size="icon" className="relative" asChild>
                <Link to="/reorder" aria-label={`Low stock alerts: ${badges.low}`} title="Low stock alerts">
                  <Icon name="bell" size={16} />
                  {badges.low > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">{badges.low}</span>
                  )}
                </Link>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
