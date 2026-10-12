import { useLocation, match } from './lib/router.jsx'
import { useStore } from './data/store.jsx'
import Layout from './components/Layout.jsx'
import { Card, Empty, Button } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Inventory from './pages/Inventory.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import { Products, ProductForm } from './pages/Products.jsx'
import { Categories, Suppliers, SupplierDetail, Locations, Users, Settings } from './pages/MasterData.jsx'
import { PurchaseOrders, POForm, PODetail, ReceiveList, ReceiveForm } from './pages/Purchasing.jsx'
import { Issue, Transfer, OpeningStock } from './pages/Movements.jsx'
import { Counts, CountDetail, Adjustments, Reorder } from './pages/Control.jsx'
import { Ledger, Reports, Audit, Setup } from './pages/Records.jsx'

// Order matters: specific routes before parameterised ones.
const ROUTES = [
  ['/', () => <Dashboard />],
  ['/setup', () => <Setup />],
  ['/inventory', (p, q) => <Inventory query={q} />],
  ['/products', () => <Products />],
  ['/products/new', () => <ProductForm />],
  ['/products/:id/edit', (p) => <ProductForm id={p.id} />],
  ['/products/:id', (p) => <ProductDetail id={p.id} />],
  ['/categories', () => <Categories />],
  ['/suppliers', () => <Suppliers />],
  ['/suppliers/:id', (p) => <SupplierDetail id={p.id} />],
  ['/locations', () => <Locations />],
  ['/opening-stock', () => <OpeningStock />],
  ['/purchase-orders', () => <PurchaseOrders />],
  ['/purchase-orders/new', (p, q) => <POForm query={q} />],
  ['/purchase-orders/:id/edit', (p, q) => <POForm id={p.id} query={q} />],
  ['/purchase-orders/:id', (p) => <PODetail id={p.id} />],
  ['/receive', () => <ReceiveList />],
  ['/receive/:poId', (p) => <ReceiveForm poId={p.poId} />],
  ['/issue', (p, q) => <Issue query={q} />],
  ['/transfer', (p, q) => <Transfer query={q} />],
  ['/counts', () => <Counts />],
  ['/counts/:id', (p) => <CountDetail id={p.id} />],
  ['/adjustments', () => <Adjustments />],
  ['/reorder', () => <Reorder />],
  ['/ledger', () => <Ledger />],
  ['/reports', () => <Reports />],
  ['/audit', () => <Audit />],
  ['/users', () => <Users />],
  ['/settings', () => <Settings />],
]

export default function App() {
  const { user } = useStore()
  const { path, query } = useLocation()
  if (!user) return <Login />

  let page = null
  for (const [pattern, render] of ROUTES) {
    const params = match(pattern, path)
    if (params) { page = render(params, query); break }
  }
  return (
    <Layout path={path}>
      {/* key forces a fresh page (and fresh form state) on every navigation */}
      <div key={path + JSON.stringify(query)}>
        {page || <div className="page"><Card pad><Empty title="Page not found" action={<Button to="/">Go to dashboard</Button>} /></Card></div>}
      </div>
    </Layout>
  )
}
