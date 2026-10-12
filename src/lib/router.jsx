// Tiny hash router (no dependency). Routes look like "#/products/abc".
import { useEffect, useState } from 'react'

function current() {
  const h = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs = ''] = h.split('?')
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) }
}

export function useLocation() {
  const [loc, setLoc] = useState(current)
  useEffect(() => {
    const on = () => { setLoc(current()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return loc
}

export function navigate(to) {
  window.location.hash = to
}

export function Link({ to, className, children, ...rest }) {
  return <a href={'#' + to} className={className} {...rest}>{children}</a>
}

// match('/products/:id', '/products/42') -> { id: '42' }
export function match(pattern, path) {
  const a = pattern.split('/').filter(Boolean)
  const b = path.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const params = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}
