# Union TMS — Performance notes

## Changes already applied in this package

| Area | Before | After |
|------|--------|--------|
| Root splash | `SplashScreenAlways` + **10s** every load | Session-only `SplashScreen` + **1.2s** |
| Home `seedIfEmpty()` | Awaited (blocked redirect) | Fire-and-forget (`void seedIfEmpty()`) |
| Login `seedIfEmpty()` | Awaited (blocked login) | Fire-and-forget |
| Admin reports | Empty `from`/`to` = **entire history** | Defaults to **last 7 days** (EAT) |
| Auditor reports | All transactions + poll **8s** | **`?today=1`** + poll **30s** |
| Transactions GET | Unbounded array | Safety **limit 2000** (max 10000 via `?limit=`) |

Copy these files into your real project:
- `app/layout.tsx`
- `app/components/SplashScreen.tsx`
- `app/page.tsx`
- `app/api/auth/login/route.ts`
- `app/admin/reports/page.tsx`
- `app/auditor/reports/page.tsx`
- `app/api/transactions/route.ts`

## Remaining bottleneck (needs `lib/`)

This zip still has **no `lib/` folder**. The main remaining cost is:

```ts
let txs = await getTransactions(); // loads EVERYTHING
// then filters in JavaScript
```

### What to do in `lib/db`

Change `getTransactions` so it accepts filters and applies them in the database (Supabase/SQL), not in memory:

```ts
type TxQuery = {
  from?: string;   // YYYY-MM-DD (EAT business day)
  to?: string;
  today?: boolean;
  cashierId?: string;
  cashierName?: string;
  limit?: number;
};

export async function getTransactions(q: TxQuery = {}) { ... }
```

Then in `api/transactions/route.ts` pass the query params into `getTransactions` and remove the in-memory filters (or keep them only as a last resort).

### Suggested indexes (Postgres / Supabase)

```sql
-- Transactions by time (most important for reports)
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON transactions (created_at DESC);

-- Optional: filter by cashier + time
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_created
  ON transactions (cashier_id, created_at DESC);

-- FT lookup (already used for uniqueness checks)
CREATE INDEX IF NOT EXISTS idx_transactions_ft
  ON transactions (ft_number);
```

If you store dates as text, prefer a real `timestamptz` column named `created_at`.

### After server-side filtering

- Admin can safely open wider ranges without downloading the whole table.
- Auditor `today=1` becomes a cheap index range scan.
- The JS `limit` remains a safety net, not the primary control.

If you share the `lib/` folder (`db.ts`, `auth.ts`, `types.ts`), the remaining optimization can be applied directly.
