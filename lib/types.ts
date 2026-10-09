export type Role = "admin" | "auditor" | "cashier" | "waiter";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  ftNumber: string;
  totalAmount: number;
  restaurantAmount: number;
  cafeAmount: number;
  butcheryAmount: number;
  tip: number;
  senderName: string;
  receiverName: string;
  imageData?: string;
  cashierId: string;
  cashierName: string;
  tableNumber: string;
  waiterId: string;
  waiterName: string;
  createdAt: string;
  status: "completed" | "pending";
}

export interface Notification {
  id: string;
  transactionId: string;
  ftNumber: string;
  totalAmount: number;
  cashierName: string;
  tableNumber: string;
  waiterName: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
}
