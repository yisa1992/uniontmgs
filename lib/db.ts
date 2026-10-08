import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import type { User, Transaction, Notification, Role } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TRANSACTIONS_FILE = path.join(DATA_DIR, "transactions.json");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON<T>(file: string, fallback: T): T {
  ensureDataDir();
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
    }
  } catch {
    // ignore corrupt files
  }
  return fallback;
}

function writeJSON<T>(file: string, data: T) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// ── Users ──────────────────────────────────────────────

export function getUsers(): User[] {
  return readJSON<User[]>(USERS_FILE, []);
}

export function getUserById(id: string): User | undefined {
  return getUsers().find((u) => u.id === id);
}

export function getUserByUsername(username: string): User | undefined {
  return getUsers().find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
}

export function createUser(data: {
  username: string;
  password: string;
  fullName: string;
  role: Role;
}): User {
  const users = getUsers();
  if (
    users.some((u) => u.username.toLowerCase() === data.username.toLowerCase())
  ) {
    throw new Error("Username already exists");
  }
  const now = new Date().toISOString();
  const user: User = {
    id: uuidv4(),
    username: data.username,
    passwordHash: bcrypt.hashSync(data.password, 10),
    fullName: data.fullName,
    role: data.role,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  users.push(user);
  writeJSON(USERS_FILE, users);
  return user;
}

export function updateUser(
  id: string,
  data: Partial<{
    fullName: string;
    role: Role;
    active: boolean;
    password: string;
  }>
): User {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("User not found");
  const user = users[idx];
  if (data.fullName !== undefined) user.fullName = data.fullName;
  if (data.role !== undefined) user.role = data.role;
  if (data.active !== undefined) user.active = data.active;
  if (data.password) user.passwordHash = bcrypt.hashSync(data.password, 10);
  user.updatedAt = new Date().toISOString();
  users[idx] = user;
  writeJSON(USERS_FILE, users);
  return user;
}

export function verifyPassword(user: User, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}

// ── Transactions ───────────────────────────────────────

export function getTransactions(): Transaction[] {
  return readJSON<Transaction[]>(TRANSACTIONS_FILE, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getTransactionByFt(ftNumber: string): Transaction | undefined {
  return getTransactions().find(
    (t) => t.ftNumber.toLowerCase() === ftNumber.toLowerCase()
  );
}

export function createTransaction(
  data: Omit<Transaction, "id" | "createdAt" | "status">
): Transaction {
  if (getTransactionByFt(data.ftNumber)) {
    throw new Error("FT number already exists");
  }
  const tx: Transaction = {
    ...data,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: "completed",
  };
  const txs = getTransactions();
  txs.unshift(tx);
  writeJSON(TRANSACTIONS_FILE, txs);

  createNotification({
    transactionId: tx.id,
    ftNumber: tx.ftNumber,
    totalAmount: tx.totalAmount,
    cashierName: tx.cashierName,
    message: `New transaction FT: ${tx.ftNumber} — ${tx.totalAmount.toLocaleString()} ETB by ${tx.cashierName}`,
  });

  return tx;
}

// ── Notifications ──────────────────────────────────────

export function getNotifications(): Notification[] {
  return readJSON<Notification[]>(NOTIFICATIONS_FILE, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function createNotification(data: {
  transactionId: string;
  ftNumber: string;
  totalAmount: number;
  cashierName: string;
  message: string;
}): Notification {
  const n: Notification = {
    id: uuidv4(),
    ...data,
    read: false,
    createdAt: new Date().toISOString(),
  };
  const list = getNotifications();
  list.unshift(n);
  writeJSON(NOTIFICATIONS_FILE, list);
  return n;
}

export function markNotificationRead(id: string): void {
  const list = getNotifications();
  const idx = list.findIndex((n) => n.id === id);
  if (idx !== -1) {
    list[idx].read = true;
    writeJSON(NOTIFICATIONS_FILE, list);
  }
}

export function markAllNotificationsRead(): void {
  const list = getNotifications().map((n) => ({ ...n, read: true }));
  writeJSON(NOTIFICATIONS_FILE, list);
}

// ── Seed ───────────────────────────────────────────────

export function seedIfEmpty() {
  const users = getUsers();
  if (users.length === 0) {
    createUser({
      username: "admin",
      password: "admin123",
      fullName: "Union Admin",
      role: "admin",
    });
    createUser({
      username: "auditor",
      password: "auditor123",
      fullName: "Union Auditor",
      role: "auditor",
    });
    createUser({
      username: "cashier",
      password: "cashier123",
      fullName: "Union Cashier",
      role: "cashier",
    });
  }
}
