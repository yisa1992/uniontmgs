"use client";

import { useEffect, useState } from "react";

const SPLASH_MS = 1_200; // 1.2 seconds (was 10s)

/**
 * Full-screen Union TMS logo splash on first app open / hard refresh.
 * Shows once per browser session for ~1.2s, then reveals the app.
 */
export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Skip splash if already shown this browser session
    try {
      if (sessionStorage.getItem("union_tms_splash_done") === "1") {
        setShow(false);
        return;
      }
    } catch {
      // ignore
    }

    const fadeTimer = setTimeout(() => setFadeOut(true), Math.max(0, SPLASH_MS - 400));
    const hideTimer = setTimeout(() => {
      setShow(false);
      try {
        sessionStorage.setItem("union_tms_splash_done", "1");
      } catch {
        // ignore
      }
    }, SPLASH_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {show && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            transition: "opacity 0.4s ease",
            opacity: fadeOut ? 0 : 1,
            pointerEvents: fadeOut ? "none" : "auto",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/splash-logo.png"
            alt="Union TMS"
            width={220}
            height={220}
            style={{
              width: "min(55vw, 220px)",
              height: "auto",
              borderRadius: 28,
              boxShadow: "0 0 48px rgba(20, 184, 166, 0.35)",
            }}
          />
          <p
            style={{
              marginTop: "1.5rem",
              color: "#94a3b8",
              fontSize: "0.9rem",
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}
          >
            Loading…
          </p>
        </div>
      )}
      {children}
    </>
  );
}
