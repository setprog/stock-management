# Stock Manager — MVP

A stock management web app built with **React + Vite**. It follows the *Stock Management System MVP Requirements*: every stock change comes from a documented transaction, current stock is calculated from a stock ledger, and every workflow ends in a clear status.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Requires Node 20.19+ (or 22+).

On first load the app fills itself with **demo data** and asks you to sign in by picking a user. Each demo user has a different role, so you can see how permissions change the screens:

| User | Role |
|---|---|
| Admin | Admin — everything, including users and settings |
| Selam A. | Inventory Manager — products, transfers, counts, adjustments and approvals, reports |
| Meron T. | Purchasing Officer — suppliers, purchase orders, reorder |
| Hana M. / Dawit K. | Storekeeper — receive, issue, transfer, count |
| Guest | Viewer — read-only |

To start with your own data, go to **Settings → Start with an empty system**. The **Setup** checklist then takes you through the steps in requirements §4: users, categories, locations, products, suppliers and opening stock.

## What's included

| Module | Where |
|---|---|
| Dashboard with quick actions and items that need attention | `pages/Dashboard.jsx` |
| Inventory (by item or by location, low/out filters) | `pages/Inventory.jsx` |
| Product detail with locations and running-balance ledger | `pages/ProductDetail.jsx` |
| Products, categories, suppliers, warehouses & locations | `pages/Products.jsx`, `pages/MasterData.jsx` |
| Opening stock, issue (with reasons), transfer | `pages/Movements.jsx` |
| Purchase orders (Draft → Ordered → Partially/Fully Received, Cancelled) and receiving | `pages/Purchasing.jsx` |
| Stock counts (Draft → Counting → Pending Review → Completed), adjustments with approval, reorder → draft POs | `pages/Control.jsx` |
| Stock ledger, 12 reports with filters and CSV export, audit log, setup checklist | `pages/Records.jsx` |
| Users & roles, settings | `pages/MasterData.jsx` |

## How it's organised

```
src/
  data/
    actions.js     ← every state change + all business rules (§22)
    selectors.js   ← derived values: balances from the ledger, incoming, low stock
    constants.js   ← roles & permissions, statuses, issue reasons
    seed.js        ← empty state + demo data (built by running the real actions)
    store.jsx      ← React context, persistence, useAction() helper
  components/
    ui/            ← shadcn/ui components (generated; add more with `npx shadcn@latest add <name>`)
    ui.jsx         ← app wrappers over shadcn (Button, Card, Field, Notice, Modal, selects…)
    Layout.jsx     ← shadcn Sidebar, global search, theme toggle, user menu
    Icon.jsx       ← named lucide-react icons
  pages/           ← one file per module group
  lib/             ← tiny hash router, formatting, CSV export, theme, cn()
  index.css        ← Tailwind v4 + shadcn theme tokens (light/dark) and layout helpers
```

**Business rules live in `src/data/actions.js`.** Each action validates the request and then writes ledger and audit entries. For example:

- Stock can't go negative.
- An issue or transfer can't exceed what's at the source location.
- Receiving can't exceed the remaining PO quantity, unless you turn that on in Settings.
- Cancelled orders can't receive stock.
- Inactive items and locations can't be used in new transactions.
- Records that have history are deactivated, never deleted.

If any rule fails, the action throws a `ValidationError`, nothing is saved, and the message is shown next to the form.

**Stock is never stored as a number on the product.** `selectors.js` adds up the ledger for each item and location, so every quantity can be traced back to the transactions behind it.

## Going to production

This MVP keeps all data in the browser (`localStorage`), and the sign-in has no passwords. Before real use:

1. **Backend and database.** Move the functions in `data/actions.js` to your API. They are plain functions of `(state, payload, { user, now })`, so the same rules can run on the server inside a database transaction. Then change `act()` in `store.jsx` to call the API.
2. **Authentication.** Replace `pages/Login.jsx` with your real login, and enforce permissions on the server (`can()` in `constants.js` holds the role matrix).
3. **Concurrency.** Do stock-availability checks inside the same database transaction that writes the ledger rows.

## Look and feel

The UI is built with [shadcn/ui](https://ui.shadcn.com) (Radix, Nova style) on Tailwind CSS v4, with lucide icons, Sonner toasts and Recharts charts. The theme uses one indigo accent; status colours (amber for low, red for out, green for received, blue for incoming) are always shown with a word, so colour is never the only signal. Light and dark mode follow the OS setting and can be switched from the top bar. All theme tokens are at the top of `src/index.css`.
