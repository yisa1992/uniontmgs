'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { FormEvent, useCallback, useState } from 'react'

type Options = {
  showSaleType?: boolean
  showProductSearch?: boolean
  /** Extra query params to keep when submitting (e.g. { view: 'returned' }) */
  preserve?: Record<string, string>
}

function todayYMD() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')!.value
  const m = parts.find((p) => p.type === 'month')!.value
  const d = parts.find((p) => p.type === 'day')!.value
  return `${y}-${m}-${d}`
}

export default function ReportFilters({
  options = {},
}: {
  options?: Options
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const today = todayYMD()
  const [from, setFrom] = useState(searchParams.get('from') || today)
  const [to, setTo] = useState(searchParams.get('to') || today)
  const [type, setType] = useState(searchParams.get('type') || 'all')
  const [q, setQ] = useState(searchParams.get('q') || '')

  const submit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault()
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (options.showSaleType && type && type !== 'all') params.set('type', type)
      if (options.showProductSearch && q.trim()) params.set('q', q.trim())
      params.set('generated', '1')
      if (options.preserve) {
        for (const [k, v] of Object.entries(options.preserve)) {
          if (v) params.set(k, v)
        }
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [from, to, type, q, options, pathname, router]
  )

  const setToday = () => {
    setFrom(today)
    setTo(today)
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4 space-y-3"
    >
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        {options.showSaleType && (
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Sale type
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white min-w-[120px]"
            >
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
              <option value="credit_partial">Credit (partial)</option>
            </select>
          </label>
        )}
        {options.showProductSearch && (
          <label className="flex flex-col gap-1 text-xs text-slate-400 flex-1 min-w-[140px]">
            Search
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Product, SKU, customer…"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white w-full"
            />
          </label>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={setToday}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Today
          </button>
          <button
            type="submit"
            className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-medium text-white"
          >
            Generate report
          </button>
        </div>
      </div>
    </form>
  )
}
