"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import type { SessionUser } from "@/lib/types";

export default function CashierPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ftNumber, setFtNumber] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [restaurant, setRestaurant] = useState("");
  const [cafe, setCafe] = useState("");
  const [butchery, setButchery] = useState("");
  const [tip, setTip] = useState("");
  const [senderName, setSenderName] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [ftExists, setFtExists] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) {
          router.push("/login");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d?.user) {
          if (d.user.role !== "cashier") {
            router.push("/");
            return;
          }
          setUser(d.user);
        }
      });
  }, [router]);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const autoTip = useCallback(() => {
    const total = parseFloat(totalAmount) || 0;
    const r = parseFloat(restaurant) || 0;
    const c = parseFloat(cafe) || 0;
    const b = parseFloat(butchery) || 0;
    const computed = Math.round((total - r - c - b) * 100) / 100;
    setTip(computed >= 0 ? String(computed) : "0");
  }, [totalAmount, restaurant, cafe, butchery]);

  useEffect(() => {
    if (totalAmount) autoTip();
  }, [totalAmount, restaurant, cafe, butchery, autoTip]);

  useEffect(() => {
    if (!ftNumber || ftNumber.length < 3) {
      setFtExists(false);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/transactions?ft=${encodeURIComponent(ftNumber)}`)
        .then((r) => r.json())
        .then((d) => setFtExists(!!d.exists))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [ftNumber]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }

  async function openCamera() {
    setCameraError("");
    setError("");
    setSuccess("");
    try {
      // Prefer rear camera on phones
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Wait for video element to mount
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      console.error(err);
      setCameraError(
        "Camera access denied or not available. Allow camera permission and try again."
      );
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    stopCamera();
    setImagePreview(dataUrl);
    runOcr(dataUrl);
  }

  async function preprocessImage(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Upscale small images for better OCR
        const scale = img.width < 1200 ? 2 : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        // Grayscale + contrast boost + mild threshold
        for (let i = 0; i < d.length; i += 4) {
          let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          // increase contrast
          gray = (gray - 128) * 1.6 + 128;
          gray = Math.max(0, Math.min(255, gray));
          // soft threshold helps phone-screen photos
          if (gray > 180) gray = 255;
          else if (gray < 80) gray = 0;
          d[i] = d[i + 1] = d[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function runOcr(dataUrl: string) {
    setScanning(true);
    setError("");
    try {
      const processed = await preprocessImage(dataUrl);
      const Tesseract = (await import("tesseract.js")).default;
      const result = await Tesseract.recognize(processed, "eng", {
        logger: () => {},
      });
      const text = result.data.text || "";
      console.log("OCR text:", text);
      parseOcrText(text);
      if (!text.trim()) {
        setError("No text detected. Retake closer, avoid glare, and fill the screen with the receipt.");
      } else {
        const hasFt = /FT[A-Z0-9]{6,}/i.test(text);
        const hasAmt = /ETB\s*[\d,]+/i.test(text) || /[\d,]+\.\d{2}/.test(text);
        if (!hasFt && !hasAmt) {
          setError("Could not read FT or amount. Move closer, reduce glare, and retake.");
        }
      }
    } catch {
      setError("OCR failed. Please retake a clearer photo of the QR / receipt.");
    } finally {
      setScanning(false);
    }
  }

  function parseOcrText(text: string) {
    // Normalize OCR noise common on phone screenshots
    const cleaned = text
      .replace(/[|]//g, "I")
      .replace(/\s+/g, " ")
      .replace(/\n+/g, "\n");
    const upper = cleaned.toUpperCase();

    // --- FT Number (CBE: ID: FT26282YJPPN or FT26282YJPPN) ---
    const ftPatterns = [
      /(?:TRANSACTION\s*)?ID\s*[:.\-]?\s*(FT[A-Z0-9]{6,18})/i,
      /\b(FT[A-Z0-9]{8,18})\b/i,
      /FT\s*[#:.\-]?\s*([A-Z0-9]{8,20})/i,
      /(?:reference|ref|txn|transaction)\s*(?:no|number|id|#)?[:.\s]*([A-Z0-9]{8,20})/i,
    ];
    for (const p of ftPatterns) {
      const m = cleaned.match(p) || upper.match(p);
      if (m) {
        const ft = (m[1].startsWith("FT") || m[1].startsWith("ft")
          ? m[1]
          : "FT" + m[1]
        ).toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (ft.length >= 8) {
          setFtNumber(ft);
          break;
        }
      }
    }

    // --- Amount (prefer transfer amount, then total debited) ---
    // CBE: "ETB 2,200.00 has been debited" or "Total Amount Debited: ETB2201.20"
    const amountPatterns = [
      /ETB\s*([\d,]+\.?\d*)\s*has\s+been\s+debited/i,
      /(?:total\s+amount\s+debited|amount\s+debited)\s*[:.\s]*ETB\s*([\d,]+\.?\d*)/i,
      /(?:total\s+amount\s+debited|amount\s+debited)\s*[:.\s]*([\d,]+\.?\d*)/i,
      /ETB\s*([\d,]+\.\d{2})\b/i,
      /(?:total|amount|sum)\s*[:.\s]*([\d,]+\.?\d*)/i,
      /([\d,]+\.\d{2})\s*(?:ETB|BIRR)?/i,
    ];
    for (const p of amountPatterns) {
      const m = cleaned.match(p);
      if (m) {
        const num = m[1].replace(/,/g, "");
        const val = parseFloat(num);
        if (!isNaN(val) && val > 0) {
          setTotalAmount(String(val));
          break;
        }
      }
    }

    // --- Sender (CBE: "debited from\nKalkidan Tafese Sefe") ---
    const senderPatterns = [
      /(?:has\s+been\s+)?debited\s+from\s+([A-Za-z][A-Za-z\s.'-]{2,50}?)(?:\s+ETB|\s+on\s|\s+for\s|\n|$)/i,
      /(?:from|sender|payer)\s*[:.\s]+([A-Za-z][A-Za-z\s.'-]{2,40})/i,
      /(?:account\s*name)\s*[:.\s]+([A-Za-z][A-Za-z\s.'-]{2,40})/i,
    ];
    for (const p of senderPatterns) {
      const m = cleaned.match(p);
      if (m) {
        const name = m[1].replace(/\s+/g, " ").trim();
        if (name.length >= 3 && !/^\d/.test(name)) {
          setSenderName(name);
          break;
        }
      }
    }

    // --- Receiver (CBE: "for Girma Eticha/girma Bar & Restaurant") ---
    const receiverPatterns = [
      /\bfor\s+([A-Za-z][A-Za-z0-9\s.&'\/-]{2,60}?)(?:\s+ETB-|\s+on\s|\s+with\s|\n|$)/i,
      /(?:to|receiver|beneficiary|credited\s+to)\s*[:.\s]+([A-Za-z][A-Za-z0-9\s.&'\/-]{2,50})/i,
    ];
    for (const p of receiverPatterns) {
      const m = cleaned.match(p);
      if (m) {
        let name = m[1].replace(/\s+/g, " ").trim();
        // Drop trailing account-like tokens (ETB-3544)
        name = name.replace(/\s*ETB-?\d+.*$/i, "").trim();
        if (name.length >= 3) {
          setReceiverName(name);
          break;
        }
      }
    }
  }

  function retakePhoto() {
    setImagePreview(null);
    setFtNumber("");
    setTotalAmount("");
    setSenderName("");
    setReceiverName("");
    openCamera();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (ftExists) {
      setError("FT number already exists in the system");
      return;
    }
    const total = parseFloat(totalAmount) || 0;
    const r = parseFloat(restaurant) || 0;
    const c = parseFloat(cafe) || 0;
    const b = parseFloat(butchery) || 0;
    const t = parseFloat(tip) || 0;
    if (Math.abs(r + c + b + t - total) > 0.01) {
      setError(
        `Sum (${(r + c + b + t).toFixed(2)}) must equal scanned amount (${total.toFixed(2)})`
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ftNumber,
          totalAmount: total,
          restaurantAmount: r,
          cafeAmount: c,
          butcheryAmount: b,
          tip: t,
          senderName,
          receiverName,
          imageData: imagePreview || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save transaction");
        setSubmitting(false);
        return;
      }
      setSuccess(
        `Transaction saved! FT: ${data.transaction.ftNumber} — Auditor has been notified.`
      );
      setFtNumber("");
      setTotalAmount("");
      setRestaurant("");
      setCafe("");
      setButchery("");
      setTip("");
      setSenderName("");
      setReceiverName("");
      setImagePreview(null);
      setFtExists(false);
      stopCamera();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  // Attach stream when video mounts after cameraOpen becomes true
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  if (!user) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  const sum =
    (parseFloat(restaurant) || 0) +
    (parseFloat(cafe) || 0) +
    (parseFloat(butchery) || 0) +
    (parseFloat(tip) || 0);
  const total = parseFloat(totalAmount) || 0;
  const balanced = Math.abs(sum - total) < 0.01 && total > 0;

  return (
    <div>
      <Navbar user={user} />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>
          New Transaction
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          Take a photo of the receipt with the camera — FT number &amp; amount are scanned automatically.
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Camera / photo section */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            <label className="label">QR Code / Receipt Photo</label>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>
              Capture the QR code or receipt. The image will be saved with the transaction.
            </p>

            {cameraError && (
              <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>
                {cameraError}
              </div>
            )}

            {/* Live camera view */}
            {cameraOpen && !imagePreview && (
              <div style={{ position: "relative" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    maxHeight: 420,
                    borderRadius: 12,
                    background: "#000",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    marginTop: "1rem",
                    justifyContent: "center",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={capturePhoto}
                    style={{ minWidth: 160, padding: "0.85rem 1.5rem", fontSize: "1rem" }}
                  >
                    📷 Capture
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={stopCamera}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Captured image preview */}
            {imagePreview && !cameraOpen && (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Captured receipt"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 320,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    display: "block",
                  }}
                />
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={retakePhoto}
                  >
                    📷 Retake photo
                  </button>
                </div>
              </div>
            )}

            {/* Start camera button */}
            {!cameraOpen && !imagePreview && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCamera}
                style={{
                  width: "100%",
                  padding: "1.25rem",
                  fontSize: "1.05rem",
                  gap: "0.6rem",
                }}
              >
                📷 Scan QR Code / Receipt Photo
              </button>
            )}

            {scanning && (
              <p
                style={{
                  color: "var(--primary)",
                  marginTop: "0.75rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                Scanning receipt with OCR… please wait
              </p>
            )}
          </div>

          {/* Scanned fields — auto-filled by OCR, not editable */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "var(--muted)" }}>
              These fields are filled automatically from the scanned receipt / QR. They cannot be edited manually.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <label className="label">FT Number *</label>
                <input
                  className="input"
                  value={ftNumber}
                  readOnly
                  placeholder="Auto-filled from scan"
                  required
                  style={{
                    background: "#f1f5f9",
                    cursor: "not-allowed",
                    ...(ftExists
                      ? { borderColor: "var(--danger)", background: "#fef2f2" }
                      : {}),
                  }}
                />
                {ftExists && (
                  <p
                    style={{
                      color: "var(--danger)",
                      fontSize: "0.8rem",
                      margin: "0.35rem 0 0",
                    }}
                  >
                    This FT number already exists
                  </p>
                )}
              </div>
              <div>
                <label className="label">Scanned Total Amount (ETB) *</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  readOnly
                  placeholder="Auto-filled from scan"
                  required
                  style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                />
              </div>
              <div>
                <label className="label">Sender Name</label>
                <input
                  className="input"
                  value={senderName}
                  readOnly
                  placeholder="Auto-filled from scan"
                  style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                />
              </div>
              <div>
                <label className="label">Receiver Account Name</label>
                <input
                  className="input"
                  value={receiverName}
                  readOnly
                  placeholder="Auto-filled from scan"
                  style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                />
              </div>
            </div>
          </div>

          {/* Split amounts */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Split Amounts</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <label className="label">Restaurant Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={restaurant}
                  onChange={(e) => setRestaurant(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">Cafe Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cafe}
                  onChange={(e) => setCafe(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">Butchery Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={butchery}
                  onChange={(e) => setButchery(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">Tip (auto-calculated)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  placeholder="0.00"
                  style={{ background: "#f8fafc" }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: "1.25rem",
                padding: "0.875rem 1rem",
                borderRadius: 8,
                background: balanced ? "#ecfdf5" : "#fef3c7",
                border: `1px solid ${balanced ? "#a7f3d0" : "#fcd34d"}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.9rem",
              }}
            >
              <span>
                Sum: <strong>{sum.toFixed(2)}</strong> / Total:{" "}
                <strong>{total.toFixed(2)}</strong>
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: balanced ? "var(--success)" : "var(--warning)",
                }}
              >
                {balanced ? "✓ Balanced" : "⚠ Must equal total"}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-success"
            style={{ width: "100%", padding: "0.85rem", fontSize: "1rem" }}
            disabled={submitting || ftExists || !balanced || !ftNumber || !imagePreview}
          >
            {submitting ? "Saving…" : "Submit Transaction"}
          </button>
        </form>
      </main>
    </div>
  );
}
