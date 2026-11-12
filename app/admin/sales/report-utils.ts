/** Shared date-range helpers for admin sales reports. */

export type DateRangeParams = {
  from?: string
  to?: string
  day?: string
}

function ymdInEAT(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")!.value
  const m = parts.find((p) => p.type === "month")!.value
  const day = parts.find((p) => p.type === "day")!.value
  return `${y}-${m}-${day}`
}

/**
 * Parse from/to from searchParams.
 * When neither is provided, defaults to the current business day (EAT).
 */
export function parseDateRange(sp: DateRangeParams): {
  from: string
  to: string
  label: string
} {
  const today = ymdInEAT()
  const from = (sp.from || sp.day || today).slice(0, 10)
  const to = (sp.to || sp.day || today).slice(0, 10)
  const label =
    from === to
      ? from === today
        ? "Today"
        : from
      : `${from} → ${to}`
  return { from, to, label }
}

export function matchSaleType(
  rowOrType:
    | string
    | null
    | undefined
    | { sale_type?: string | null; payment_type?: string | null },
  typeFilter: string
): boolean {
  if (!typeFilter || typeFilter === "all") return true
  const t =
    typeof rowOrType === "string" || rowOrType == null
      ? String(rowOrType || "").toLowerCase()
      : (rowOrType.sale_type || rowOrType.payment_type || "").toLowerCase()
  const f = typeFilter.toLowerCase()
  return t === f || t.startsWith(f)
}
