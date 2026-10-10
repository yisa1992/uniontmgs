import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "./components/pwa-register";
import SplashScreenAlways from "./components/SplashScreenAlways";

export const metadata: Metadata = {
  title: "Union TMS",
  description: "Union Transaction Management System — Admin, Auditor & Cashier",
  applicationName: "Union TMS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Union TMS",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SplashScreenAlways>
          {children}
          <PwaRegister />
        </SplashScreenAlways>
      </body>
    </html>
  );
}
