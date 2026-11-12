'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export type NotificationType =
  | 'product_added'
  | 'product_edited'
  | 'product_deleted'
  | 'stock_adjusted'
  | 'price_updated'
  | 'other'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  entity_id?: string | null
  entity_name?: string | null
  actor?: string | null
  is_read: boolean
  created_at: string
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  }
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Run this SQL once in Supabase SQL editor (Dashboard → SQL → New query):
 *
 * create extension if not exists pgcrypto;
 * create table if not exists public.notifications (
 *   id uuid primary key default gen_random_uuid(),
 *   type text not null,
 *   title text not null,
 *   message text not null default '',
 *   entity_id text,
 *   entity_name text,
 *   actor text,
 *   is_read boolean not null default false,
 *   created_at timestamptz not null default now()
 * );
 * create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
 * create index if not exists notifications_is_read_idx on public.notifications (is_read);
 * -- Service role bypasses RLS; optional open policy for debugging:
 * alter table public.notifications enable row level security;
 * drop policy if exists "service and authenticated read" on public.notifications;
 * create policy "authenticated read notifications"
 *   on public.notifications for select to authenticated using (true);
 */

export async function logNotification(input: {
  type: NotificationType
  title: string
  message?: string
  entity_id?: string | null
  entity_name?: string | null
  actor?: string | null
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const admin = getAdminClient()
    const { error } = await admin.from('notifications').insert({
      type: input.type,
      title: input.title,
      message: input.message || '',
      entity_id: input.entity_id ?? null,
      entity_name: input.entity_name ?? null,
      actor: input.actor ?? null,
      is_read: false,
    })
    if (error) {
      console.error('[notifications] insert failed:', error.message)
      return { error: error.message }
    }
    revalidatePath('/admin/notifications')
    revalidatePath('/admin')
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to log notification'
    console.error('[notifications]', msg)
    return { error: msg }
  }
}

export async function getNotifications(limit = 50): Promise<{
  items: AppNotification[]
  error?: string
  tableMissing?: boolean
}> {
  try {
    const admin = getAdminClient()
    const { data, error } = await admin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      const msg = error.message || ''
      const tableMissing =
        msg.toLowerCase().includes('does not exist') ||
        msg.toLowerCase().includes('schema cache') ||
        msg.toLowerCase().includes('relation')
      console.error('[notifications] list failed:', msg)
      return { items: [], error: msg, tableMissing }
    }

    const items = (data || []).map((row: any) => ({
      id: row.id as string,
      type: row.type as NotificationType,
      title: row.title as string,
      message: (row.message as string) || '',
      entity_id: row.entity_id ?? null,
      entity_name: row.entity_name ?? null,
      actor: row.actor ?? null,
      is_read: Boolean(row.is_read),
      created_at: row.created_at as string,
    }))
    return { items }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load notifications'
    return { items: [], error: msg }
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const admin = getAdminClient()
    const { count, error } = await admin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)

    if (error) {
      console.error('[notifications] count failed:', error.message)
      return 0
    }
    return count ?? 0
  } catch {
    return 0
  }
}

export async function markNotificationRead(id: string) {
  try {
    const admin = getAdminClient()
    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/notifications')
    return { success: true }
  } catch {
    return { error: 'Failed' }
  }
}

export async function markAllNotificationsRead() {
  try {
    const admin = getAdminClient()
    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
    if (error) return { error: error.message }
    revalidatePath('/admin/notifications')
    return { success: true }
  } catch {
    return { error: 'Failed' }
  }
}

export async function deleteNotification(id: string) {
  try {
    const admin = getAdminClient()
    const { error } = await admin.from('notifications').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/notifications')
    return { success: true }
  } catch {
    return { error: 'Failed' }
  }
}

/** Insert a sample notification so you can verify the UI works */
export async function createTestNotification() {
  return logNotification({
    type: 'other',
    title: 'Test notification',
    message:
      'If you see this, the notifications table is working. Product changes will appear here too.',
  })
}
