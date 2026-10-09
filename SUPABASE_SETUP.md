# Fix: EROFS read-only file system on Vercel

Vercel cannot write to `data/transactions.json`. Data must use **Supabase**.

## 1. Create tables in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Go to **SQL Editor** → New query
3. Paste and run the contents of `supabase/schema.sql`

## 2. Add environment variables on Vercel

Project → Settings → Environment Variables:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | your **service_role** key (secret) |
| `JWT_SECRET` | any long random string |

Get keys from: Supabase → Project Settings → API

## 3. Deploy these files

Replace in your repo:

- `lib/db.ts`  ← uses Supabase instead of JSON files
- `app/api/transactions/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/users/route.ts`
- `app/api/notifications/route.ts`

Then:

```bash
git add lib/db.ts app/api/
git commit -m "Fix EROFS: store data in Supabase instead of local JSON"
git push origin main
```

## 4. First login

After deploy, log in once. `seedIfEmpty()` will create:

| User | Password |
|------|----------|
| admin | admin123 |
| auditor | auditor123 |
| cashier | cashier123 |

Change passwords after first login.
