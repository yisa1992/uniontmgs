'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { payCreditSale } from '@/app/actions/sales'

export default function PayCreditButton({
  saleId,
  productName,
  outstanding,
}: {
  saleId: string
  productName: string
  outstanding: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (outstanding <= 0) {
    return (
      <span className="text-xs text-emerald-500 font-medium">Paid</span>
    )
  }

  const onConfirm = () => {
    setError(null)
    startTransition(async () => {
      const res = await payCreditSale(saleId, password)
      if (res.error) {
        setError(res.error)
        return
      }
      setOpen(false)
      setPassword('')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setPassword('')
          setOpen(true)
        }}
        className="rounded-lg bg-emerald-700/80 hover:bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"
      >
        Mark paid
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl space-y-3"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-white font-semibold text-sm">Mark credit paid</h3>
            <p className="text-xs text-slate-400">
              Confirm payment of{' '}
              <span className="text-emerald-400 font-medium">
                {outstanding.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>{' '}
              for <span className="text-slate-200">{productName}</span>.
            </p>
            <label className="block text-xs text-slate-400">
              Admin password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onConfirm()
                }}
              />
            </label>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !password.trim()}
                onClick={onConfirm}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white"
              >
                {pending ? 'Saving…' : 'Confirm paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
