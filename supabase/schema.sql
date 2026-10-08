-- Run this in Supabase Dashboard → SQL Editor → New query

-- Users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'auditor', 'cashier')),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  ft_number text unique not null,
  total_amount numeric(12,2) not null,
  restaurant_amount numeric(12,2) default 0,
  cafe_amount numeric(12,2) default 0,
  butchery_amount numeric(12,2) default 0,
  tip numeric(12,2) default 0,
  sender_name text default '',
  receiver_name text default '',
  image_data text,
  cashier_id uuid references users(id),
  cashier_name text not null,
  status text default 'completed',
  created_at timestamptz default now()
);

-- Notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  ft_number text not null,
  total_amount numeric(12,2) not null,
  cashier_name text not null,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_transactions_ft on transactions (ft_number);
create index if not exists idx_transactions_created on transactions (created_at desc);
create index if not exists idx_notifications_created on notifications (created_at desc);
create index if not exists idx_notifications_read on notifications (read);

-- Optional: allow service role full access (default). Enable RLS only if you use anon key for client.
-- alter table users enable row level security;
-- alter table transactions enable row level security;
-- alter table notifications enable row level security;
