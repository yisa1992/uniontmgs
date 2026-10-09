-- Run in Supabase SQL Editor (safe to re-run)

-- Users (include waiter role)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'auditor', 'cashier', 'waiter')),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- If users table already exists without waiter, widen the check:
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin', 'auditor', 'cashier', 'waiter'));

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
  table_number text default '',
  waiter_id uuid references users(id),
  waiter_name text default '',
  status text default 'completed',
  created_at timestamptz default now()
);

-- Add columns if table already existed
alter table transactions add column if not exists table_number text default '';
alter table transactions add column if not exists waiter_id uuid references users(id);
alter table transactions add column if not exists waiter_name text default '';

-- Notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  ft_number text not null,
  total_amount numeric(12,2) not null,
  cashier_name text not null,
  table_number text default '',
  waiter_name text default '',
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table notifications add column if not exists table_number text default '';
alter table notifications add column if not exists waiter_name text default '';

create index if not exists idx_transactions_ft on transactions (ft_number);
create index if not exists idx_transactions_created on transactions (created_at desc);
create index if not exists idx_notifications_created on notifications (created_at desc);
create index if not exists idx_notifications_read on notifications (read);
