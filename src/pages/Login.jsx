import { useState } from 'react'
import { useStore } from '../data/store.jsx'
import { ROLES } from '../data/constants.js'
import { initials } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { navigate } from '../lib/router.jsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

const FEATS = [
  { icon: 'layers', t: 'Live inventory', d: 'Every unit, every location.' },
  { icon: 'cart', t: 'Purchasing', d: 'Order, receive, reorder.' },
  { icon: 'shield', t: 'Full audit trail', d: 'Who did what, and when.' },
]

// Demo sign-in: pick a user. Replace with your real authentication when you add a backend.
export default function Login() {
  const { state, signIn } = useStore()
  const users = state.users.filter((u) => u.active)
  const [sel, setSel] = useState(users[0]?.id)
  const go = (id) => { navigate('/'); signIn(id) }
  const name = state.settings.companyName || 'Stock Manager'
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,--alpha(var(--color-indigo-500)/45%),transparent_45%),radial-gradient(circle_at_10%_90%,--alpha(var(--color-sky-500)/20%),transparent_45%)]" />
        <div className="relative flex items-center gap-2.5 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Icon name="box" size={16} /></span>
          {name}
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">Stock control that keeps up with your business.</h2>
          <p className="mt-4 text-base text-white/70">Receive, issue, transfer and count stock across every warehouse — with a ledger you can trust.</p>
        </div>
        <div className="relative grid max-w-lg grid-cols-3 gap-3">
          {FEATS.map((f) => (
            <div key={f.t} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3.5 text-sm text-white/70 backdrop-blur">
              <Icon name={f.icon} size={18} className="text-indigo-300" />
              <b className="text-white">{f.t}</b>{f.d}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex items-center justify-center p-4 md:p-10">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 font-semibold lg:hidden">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Icon name="box" size={14} /></span>
              {name}
            </div>
            <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
            <CardDescription>Choose who you are. What you can do depends on your role.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={sel} onValueChange={setSel} aria-label="User" className="gap-2">
              {users.map((u) => (
                <Label key={u.id} onDoubleClick={() => go(u.id)}
                  className="items-center gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5">
                  <Avatar className="size-9"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(u.name)}</AvatarFallback></Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{u.name}</span>
                    <span className="block text-xs leading-snug text-muted-foreground">{ROLES[u.role].label} — {ROLES[u.role].blurb}</span>
                  </span>
                  <RadioGroupItem value={u.id} />
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button size="lg" className="w-full" disabled={!sel} onClick={() => go(sel)}>Continue <Icon name="arrow" size={16} /></Button>
            <p className="m-0 text-center text-xs text-muted-foreground">Demo sign-in without passwords. Connect your own login provider before going live.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
