import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "./supabase";
import type { User, Transaction, Notification, Role } from "./types";

// ── Row mappers (DB snake_case ↔ app camelCase) ─────────

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    fullName: String(row.full_name),
    role: row.role as Role,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    ftNumber: String(row.ft_number),
    totalAmount: Number(row.total_amount),
    restaurantAmount: Number(row.restaurant_amount ?? 0),
    cafeAmount: Number(row.cafe_amount ?? 0),
    butcheryAmount: Number(row.butchery_amount ?? 0),
    tip: Number(row.tip ?? 0),
    senderName: String(row.sender_name ?? ""),
    receiverName: String(row.receiver_name ?? ""),
    imageData: row.image_data ? String(row.image_data) : undefined,
    cashierId: String(row.cashier_id ?? ""),
    cashierName: String(row.cashier_name),
    createdAt: String(row.created_at),
    status: (row.status as Transaction["status"]) || "completed",
  };
}

function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    transactionId: String(row.transaction_id),
    ftNumber: String(row.ft_number),
    totalAmount: Number(row.total_amount),
    cashierName: String(row.cashier_name),
    message: String(row.message),
    read: Boolean(row.read),
    createdAt: String(row.created_at),
  };
}

// ── Users ──────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(mapUser);
}

export async function getUserById(id: string): Promise<User | undefined> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapUser(data) : undefined;
}

export async function getUserByUsername(
  username: string
): Promise<User | undefined> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .ilike("username", username)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapUser(data) : undefined;
}

export async function createUser(data: {
  username: string;
  password: string;
  fullName: string;
  role: Role;
}): Promise<User> {
  const existing = await getUserByUsername(data.username);
  if (existing) throw new Error("Username already exists");

  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    username: data.username,
    password_hash: bcrypt.hashSync(data.password, 10),
    full_name: data.fullName,
    role: data.role,
    active: true,
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error } = await supabaseAdmin
    .from("users")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapUser(inserted);
}

export async function updateUser(
  id: string,
  data: Partial<{
    fullName: string;
    role: Role;
    active: boolean;
    password: string;
  }>
): Promise<User> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.fullName !== undefined) patch.full_name = data.fullName;
  if (data.role !== undefined) patch.role = data.role;
  if (data.active !== undefined) patch.active = data.active;
  if (data.password) patch.password_hash = bcrypt.hashSync(data.password, 10);

  const { data: updated, error } = await supabaseAdmin
    .from("users")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapUser(updated);
}

export function verifyPassword(user: User, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}

// ── Transactions ───────────────────────────────────────

export async function getTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapTransaction);
}

export async function getTransactionByFt(
  ftNumber: string
): Promise<Transaction | undefined> {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .ilike("ft_number", ftNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTransaction(data) : undefined;
}

export async function createTransaction(
  data: Omit<Transaction, "id" | "createdAt" | "status">
): Promise<Transaction> {
  const existing = await getTransactionByFt(data.ftNumber);
  if (existing) throw new Error("FT number already exists");

  const row = {
    id: uuidv4(),
    ft_number: data.ftNumber,
    total_amount: data.totalAmount,
    restaurant_amount: data.restaurantAmount,
    cafe_amount: data.cafeAmount,
    butchery_amount: data.butcheryAmount,
    tip: data.tip,
    sender_name: data.senderName || "",
    receiver_name: data.receiverName || "",
    image_data: data.imageData || null,
    cashier_id: data.cashierId || null,
    cashier_name: data.cashierName,
    status: "completed",
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabaseAdmin
    .from("transactions")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const tx = mapTransaction(inserted);

  await createNotification({
    transactionId: tx.id,
    ftNumber: tx.ftNumber,
    totalAmount: tx.totalAmount,
    cashierName: tx.cashierName,
    message: `New transaction FT: ${tx.ftNumber} — ${tx.totalAmount.toLocaleString()} ETB by ${tx.cashierName}`,
  });

  return tx;
}

// ── Notifications ──────────────────────────────────────

export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapNotification);
}

export async function createNotification(data: {
  transactionId: string;
  ftNumber: string;
  totalAmount: number;
  cashierName: string;
  message: string;
}): Promise<Notification> {
  const row = {
    id: uuidv4(),
    transaction_id: data.transactionId,
    ft_number: data.ftNumber,
    total_amount: data.totalAmount,
    cashier_name: data.cashierName,
    message: data.message,
    read: false,
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabaseAdmin
    .from("notifications")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapNotification(inserted);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("read", false);
  if (error) throw new Error(error.message);
}

// ── Seed demo users if empty ───────────────────────────

export async function seedIfEmpty(): Promise<void> {
  const users = await getUsers();
  if (users.length > 0) return;

  await createUser({
    username: "admin",
    password: "admin123",
    fullName: "Union Admin",
    role: "admin",
  });
  await createUser({
    username: "auditor",
    password: "auditor123",
    fullName: "Union Auditor",
    role: "auditor",
  });
  await createUser({
    username: "cashier",
    password: "cashier123",
    fullName: "Union Cashier",
    role: "cashier",
  });
}
