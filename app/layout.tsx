import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Union TMS",
  description: "Union Transaction Management System — Admin, Auditor & Cashier",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
