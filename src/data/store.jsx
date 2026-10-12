import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { demoState, emptyState, SCHEMA_VERSION } from './seed.js'
import { computeBalances, computeIncoming, indexBy } from './selectors.js'
import { ValidationError } from './actions.js'
import { can } from './constants.js'
import { toast as sonner } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from '../lib/theme.js'

// Persistence: this MVP keeps data in the browser (localStorage).
// To move to a backend, replace load/save and make `act` call your API — the action
// functions in actions.js are written so the same rules can run on a server.
const KEY = 'stock-mvp:data'
const SESSION_KEY = 'stock-mvp:session'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (s && s.version === SCHEMA_VERSION) return s
    }
  } catch { /* ignore */ }
  return demoState()
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage full or blocked */ }
}
function loadSession() {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}

const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(load)
  const [userId, setUserId] = useState(loadSession)
  const ref = useRef(state)
  ref.current = state

  const user = state.users.find((u) => u.id === userId && u.active) || null

  const { theme } = useTheme()

  const toast = useCallback((msg, tone = 'ok') => {
    if (tone === 'bad') sonner.error(msg)
    else sonner.success(msg)
  }, [])

  // Run an action against a copy of state. Throws ValidationError on rule violations (nothing saved).
  const act = useCallback((fn, payload) => {
    const draft = structuredClone(ref.current)
    const u = draft.users.find((x) => x.id === userId)
    if (!u || !u.active) throw new ValidationError('Please sign in again.')
    const result = fn(draft, payload, { user: u, now: new Date().toISOString() })
    ref.current = draft
    setState(draft)
    save(draft)
    return result
  }, [userId])

  const signIn = useCallback((id) => {
    setUserId(id)
    try { id ? localStorage.setItem(SESSION_KEY, id) : localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  }, [])

  const reset = useCallback((mode) => {
    const s = mode === 'empty' ? emptyState(user ? user.name : 'Admin') : demoState()
    if (mode === 'empty' && user) s.users[0].id = user.id
    ref.current = s
    setState(s)
    save(s)
    if (mode !== 'empty') signIn('u_admin')
  }, [user, signIn])

  const derived = useMemo(() => {
    const { byLoc, byProduct } = computeBalances(state.ledger)
    return {
      byLoc,
      onHand: (pid) => byProduct.get(pid) || 0,
      at: (pid, lid) => byLoc.get(pid + '|' + lid) || 0,
      incoming: computeIncoming(state.purchaseOrders),
      products: indexBy(state.products),
      categories: indexBy(state.categories),
      suppliers: indexBy(state.suppliers),
      warehouses: indexBy(state.warehouses),
      locations: indexBy(state.locations),
      users: indexBy(state.users),
    }
  }, [state])

  const value = useMemo(() => ({
    state, user, act, toast, signIn, reset, d: derived,
    can: (perm) => can(user, perm),
  }), [state, user, act, toast, signIn, reset, derived])

  return (
    <StoreCtx.Provider value={value}>
      {children}
      <Toaster theme={theme} position="bottom-right" richColors closeButton />
    </StoreCtx.Provider>
  )
}

export function useStore() {
  return useContext(StoreCtx)
}

// Helper hook for forms: run an action, show errors inline, toast on success.
export function useAction() {
  const { act, toast } = useStore()
  const [error, setError] = useState('')
  const run = useCallback((fn, payload, successMsg) => {
    setError('')
    try {
      const r = act(fn, payload)
      if (successMsg) toast(typeof successMsg === 'function' ? successMsg(r) : successMsg)
      return { ok: true, result: r }
    } catch (e) {
      if (e instanceof ValidationError) { setError(e.message); return { ok: false } }
      console.error(e)
      setError('Something went wrong. Nothing was saved.')
      return { ok: false }
    }
  }, [act, toast])
  return { run, error, setError }
}
