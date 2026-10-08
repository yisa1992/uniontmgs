# Union TMS

**Union Transaction Management System** — multi-role app for Admin, Auditor, and Cashier.

Data is stored in local JSON files under `data/` (no external database required).

---

## Features

### Cashier
- Upload / capture transaction receipt image
- OCR scan of FT number, total amount, sender & receiver
- Split: Restaurant, Cafe, Butchery, Tip (tip auto-balances to total)
- Duplicate FT numbers blocked
- Submits → Auditor notification

### Auditor
- Live notification feed (every 8 seconds)
- Mark read / view full transaction detail

### Admin
- Reports with filters & search
- Summary cards
- User management (create / edit / roles)

---

## Setup

```bash
cd union-tms
npm install
npm run dev
```

Open **http://localhost:3000**

> If you see `Can't resolve 'bcryptjs'` / `jose` / `uuid`, run `npm install` again.

---

## Demo accounts

| Role    | Username  | Password    |
|---------|-----------|-------------|
| Admin   | admin     | admin123    |
| Auditor | auditor   | auditor123  |
| Cashier | cashier   | cashier123  |

---

## Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS v4
- JSON file storage (`data/`)
- Tesseract.js (OCR)
- jose (JWT) + bcryptjs
"# tms" 
"# uniontmg" 
