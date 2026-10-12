// Named icon lookup over lucide-react (the shadcn icon set). Usage: <Icon name="search" />
import {
  AlertCircle, ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpFromLine, BarChart3, Bell, BookOpen, Box, Check,
  ClipboardCheck, Download, FileText, Flag, Folder, Info, LayoutDashboard, Layers, LogOut, Menu, Moon, Plus, RefreshCw,
  Search, Settings, ShieldCheck, ShoppingCart, SlidersHorizontal, SquareCheck, Sun, Tag, TrendingUp, Truck, Users, Wallet,
  Warehouse, X,
} from 'lucide-react'

const ICONS = {
  box: Box, search: Search, in: ArrowDownToLine, out: ArrowUpFromLine, transfer: ArrowLeftRight, doc: FileText,
  check: SquareCheck, plus: Plus, info: Info, alert: AlertCircle, x: X, arrow: ArrowRight, tick: Check, menu: Menu,
  download: Download, logout: LogOut, home: LayoutDashboard, layers: Layers, clipboard: ClipboardCheck,
  sliders: SlidersHorizontal, cart: ShoppingCart, refresh: RefreshCw, truck: Truck, book: BookOpen, chart: BarChart3,
  shield: ShieldCheck, tag: Tag, folder: Folder, warehouse: Warehouse, flag: Flag, users: Users, settings: Settings,
  wallet: Wallet, bell: Bell, trend: TrendingUp, sun: Sun, moon: Moon,
}

export default function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 2, style, className }) {
  const C = ICONS[name] || Box
  return <C size={size} color={color} strokeWidth={strokeWidth} style={style} className={className} aria-hidden="true" />
}
