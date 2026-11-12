'use client'

import type { Product } from '@/app/actions/products'

function formatMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function ProductDetailModal({
  product,
  onClose,
}: {
  product: Product
  onClose: () => void
}) {
  const qty = Number(product.stock_qty) || 0
  const price = Number(product.price) || 0
  const cost = Number(product.cost) || 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">{product.name}</h2>
            {product.name_am ? (
              <p className="text-sm text-slate-400" lang="am">
                {product.name_am}
              </p>
            ) : null}
            <p className="text-xs font-mono text-emerald-400 mt-1">{product.sku}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-1"
          >
            ✕
          </button>
        </div>

        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-40 object-cover rounded-xl border border-slate-700 mb-4"
          />
        ) : null}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {(
            [
              ['Category', product.category || '—'],
              ['Unit', product.unit || '—'],
              ['Barcode', product.barcode || '—'],
              ['Stock', String(qty)],
              ['Sell price', formatMoney(price)],
              ['Cost', formatMoney(cost)],
              ['Low stock at', String(product.low_stock_threshold ?? '—')],
              ['Purchase', product.purchase_type || '—'],
              ['Supplier', product.supplier_name || '—'],
              ['Supplier phone', product.supplier_phone || '—'],
            ] as [string, string][]
          ).map(([label, val]) => (
            <div key={label}>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                {label}
              </div>
              <div className="font-medium text-slate-100">{val}</div>
            </div>
          ))}
        </div>

        {product.description ? (
          <p className="mt-4 text-sm text-slate-400 border-t border-slate-800 pt-3">
            {product.description}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-slate-600 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  )
}
