'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Pay outstanding supplier credit on a product purchase.
 */
export default function PayProductCreditButton({
  productId,
  productName,
  outstanding,
}: {
  productId: string
  productName: string
  outstanding: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  if (outstanding <= 0) {
    return (
      <span className="text-xs font-semibold text-emerald-400">Paid</span>
    )
  }

  async function handlePay() {
    const amount = window.prompt(
      `Pay supplier credit for "${productName}"\nOutstanding: ${outstanding.toFixed(2)}\nEnter amount:`,
      String(outstanding)
    )
    if (amount == null) return
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) {
      setMsg('Invalid amount')
      return
    }
    setLoading(true)
    setMsg('')
    try {
      await fetch('/api/products/pay-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, amount: n }),
      }).catch(() => null)
      setMsg('Recorded')
      router.refresh()
    } catch {
      setMsg('Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 px-3 py-1.5 text-xs font-bold text-white"
      >
        {loading ? '…' : 'Pay'}
      </button>
      {msg && <span className="text-[10px] text-slate-400">{msg}</span>}
    </div>
  )
}
