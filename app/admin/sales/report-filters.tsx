'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'

type Options = {
  showSaleType?: boolean
  showProductSearch?: boolean
  showPayment?: boolean
  showBank?: boolean
  banks?: string[]
  preserve?: Record<string, string>
}

export default function ReportFilters({
  options = {},
}: {
  options?: Options
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [from, setFrom] = useState(searchParams.get('from') || '')
  const [to, setTo] = useState(searchParams.get('to') || '')
  const [type, setType] = useState(searchParams.get('type') || 'all')
  const [pay, setPay] = useState(searchParams.get('pay') || 'all')
  const [bank, setBank] = useState(searchParams.get('bank') || '')
  const [q, setQ] = useState(searchParams.get('q') || '')

  function generate() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (options.showSaleType && type && type !== 'all') params.set('type', type)
    if (options.showPayment && pay && pay !== 'all') params.set('pay', pay)
    if (options.showBank && bank) params.set('bank', bank)
    if (options.showProductSearch && q.trim()) params.set('q', q.trim())
    params.set('generated', '1')
    if (options.preserve) {
      for (const [k, v] of Object.entries(options.preserve)) {
        if (v) params.set(k, v)
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block text-xs text-slate-400">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-slate-400">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        {options.showSaleType && (
          <label className="block text-xs text-slate-400">
            Sale type
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mb">MB</option>
              <option value="credit">Credit</option>
            </select>
          </label>
        )}
        {options.showPayment && (
          <label className="block text-xs text-slate-400">
            Payment
            <select
              value={pay}
              onChange={(e) => setPay(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mb">MB</option>
              <option value="credit">Credit</option>
            </select>
          </label>
        )}
        {options.showBank && (
          <label className="block text-xs text-slate-400">
            Bank
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">All banks</option>
              {(options.banks || []).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        )}
        {options.showProductSearch && (
          <label className="block text-xs text-slate-400">
            Search
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Product, SKU, customer…"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
        )}
      </div>
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white"
      >
        {isPending ? 'Loading…' : 'Generate report'}
      </button>
    </div>
  )
}
