'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  const [loading, setLoading] = useState(false)

  async function handleReturn() {
    const qtyStr = window.prompt(
      `Return "${productName}"\nSold qty: ${quantity}\nEnter quantity to return:`,
      String(quantity)
    )
    if (qtyStr == null) return
    const qty = parseFloat(qtyStr)
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('Invalid quantity')
      return
    }
    if (!window.confirm(`Return ${qty} of ${productName}?`)) return
    setLoading(true)
    try {
      await fetch('/api/sales/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId, quantity: qty }),
      }).catch(() => null)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleReturn}
      disabled={loading}
      className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-2.5 py-1 text-xs font-semibold text-slate-200"
    >
      {loading ? '…' : 'Return'}
    </button>
  )
}
