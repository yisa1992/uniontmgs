'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { returnSale } from '@/app/actions/sales'

export default function ReturnSaleButton({
  saleId,
  productName,
  quantity,
}: {
  saleId: string
  productName: string
  quantity: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onConfirm = () => {
    setError(null)
    startTransition(async () => {
      const res = await returnSale(saleId, reason.trim() || undefined)
      if (res.error) {
        setError(res.error)
        return
      }
      setOpen(false)
      setReason('')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setReason('')
          setOpen(true)
        }}
        className="rounded-lg border border-orange-800/60 bg-orange-950/40 hover:bg-orange-900/50 px-2.5 py-1 text-xs font-medium text-orange-200"
      >
        Return
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl space-y-3"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-white font-semibold text-sm">Return sale</h3>
            <p className="text-xs text-slate-400">
              Restore stock and remove this sale from reports:{' '}
              <span className="text-slate-200">
                {quantity} × {productName}
              </span>
              .
            </p>
            <label className="block text-xs text-slate-400">
              Reason (optional)
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Damaged, wrong item…"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onConfirm()
                }}
              />
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
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
                disabled={pending}
                onClick={onConfirm}
                className="rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white"
              >
                {pending ? 'Returning…' : 'Confirm return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
