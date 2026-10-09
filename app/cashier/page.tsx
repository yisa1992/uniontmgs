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
  const [tableNumber, setTableNumber] = useState("");
  const [waiterId, setWaiterId] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [waiters, setWaiters] = useState<{ id: string; fullName: string }[]>([]);
  const [ftExists, setFtExists] = useState(false);
  const [fieldsLocked, setFieldsLocked] = useState(true);
  const scanLoopRef = useRef<number | null>(null);

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
          // Load active waiters for dropdown
          fetch("/api/users?role=waiter")
            .then((r) => r.json())
            .then((w) => {
              if (Array.isArray(w.users)) {
                setWaiters(
                  w.users.map((u: { id: string; fullName: string }) => ({
                    id: u.id,
                    fullName: u.fullName,
                  }))
                );
              }
            })
            .catch(() => {});
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
    processReceiptImage(dataUrl);
  }

  /** Decode QR from image data URL using jsQR */
  async function decodeQrFromDataUrl(dataUrl: string): Promise<string | null> {
    try {
      const jsQR = (await import("jsqr")).default;
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
      return code?.data || null;
    } catch (e) {
      console.warn("QR decode failed", e);
      return null;
    }
  }

  /** Parse CBE QR payload (URL or text) into FT / hints */
  function parseQrPayload(payload: string): { ft?: string; amount?: string; raw: string } {
    const raw = payload.trim();
    const out: { ft?: string; amount?: string; raw: string } = { raw };

    // https://apps.cbe.com.et:100/?id=FT26140P01YB60536171
    const idMatch = raw.match(/[?&]id=([A-Za-z0-9]+)/i);
    if (idMatch) {
      const id = idMatch[1];
      const ftPart = id.match(/^(FT[A-Z0-9]{8,16})/i);
      if (ftPart) out.ft = ftPart[1].toUpperCase();
    }

    // Plain FT or other transaction number in QR text
    if (!out.ft) {
      const ft = raw.match(/\b(FT[A-Z0-9]{8,20})\b/i);
      if (ft) out.ft = ft[1].toUpperCase();
    }
    if (!out.ft) {
      const ref = raw.match(
        /(?:txn|ref|reference|transaction|id)[=:/\s-]*([A-Z0-9]{6,24})/i
      );
      if (ref) out.ft = ref[1].toUpperCase();
    }

    // Amount if present
    const amt = raw.match(/(?:amount|amt|etb)[=:\s]*([\d,]+\.?\d*)/i);
    if (amt) out.amount = amt[1].replace(/,/g, "");

    return out;
  }

  async function preprocessImage(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
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
        for (let i = 0; i < d.length; i += 4) {
          let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          gray = (gray - 128) * 1.8 + 128;
          gray = Math.max(0, Math.min(255, gray));
          if (gray > 170) gray = 255;
          else if (gray < 90) gray = 0;
          d[i] = d[i + 1] = d[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function processReceiptImage(dataUrl: string) {
    setScanning(true);
    setError("");
    setFieldsLocked(true);
    let filledFt = false;
    let filledAmt = false;

    try {
      // 1) QR first — most reliable for CBE receipts
      const qrPayload = await decodeQrFromDataUrl(dataUrl);
      if (qrPayload) {
        console.log("QR payload:", qrPayload);
        const parsed = parseQrPayload(qrPayload);
        if (parsed.ft) {
          setFtNumber(parsed.ft);
          filledFt = true;
        }
        if (parsed.amount) {
          setTotalAmount(parsed.amount);
          filledAmt = true;
        }
      }

      // 2) OCR for text fields (and anything QR missed)
      const processed = await preprocessImage(dataUrl);
      const Tesseract = (await import("tesseract.js")).default;
      const result = await Tesseract.recognize(processed, "eng", {
        logger: () => {},
      });
      const text = result.data.text || "";
      console.log("OCR text:", text);
      const before = { ft: filledFt, amt: filledAmt };
      parseOcrText(text, { skipFt: filledFt, skipAmount: filledAmt });

      // Heuristic: if OCR found FT in text
      if (!filledFt && /FT[A-Z0-9]{6,}/i.test(text)) filledFt = true;
      if (!filledAmt && /ETB\s*[\d,]+/i.test(text)) filledAmt = true;

      if (!text.trim() && !qrPayload) {
        setError(
          "No QR or text detected. Point at the QR code, or unlock and type the transaction number from the receipt."
        );
        setFieldsLocked(false);
      } else if (!filledFt) {
        setError(
          "FT / transaction number not found in the picture. Unlock and type the transaction number from the receipt, then save."
        );
        setFieldsLocked(false);
      }
    } catch (e) {
      console.error(e);
      setError("Scan failed. Unlock fields to enter manually, or retake the photo.");
      setFieldsLocked(false);
    } finally {
      setScanning(false);
    }
  }

  function parseOcrText(
    text: string,
    opts: { skipFt?: boolean; skipAmount?: boolean } = {}
  ) {
    const cleaned = text
      .replace(/\|/g, "I")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, " ")
      .replace(/\n+/g, "\n");

    // --- FT / Transaction Number ---
    if (!opts.skipFt) {
      const txPatterns = [
        // Standard CBE FT
        /(?:TRANSACTION\s*)?ID\s*[:.\-]?\s*(FT[A-Z0-9]{6,20})/i,
        /\b(FT[A-Z0-9]{8,20})\b/i,
        /FT\s*[#:.\-]?\s*([A-Z0-9]{8,20})/i,
        // Labeled transaction / reference number (may not start with FT)
        /(?:transaction\s*(?:no|number|id|#)|txn\s*(?:no|number|id|#)?|reference\s*(?:no|number|#)?|ref\s*(?:no|number|#)?)\s*[:.\-]?\s*([A-Z0-9]{6,24})/i,
        /(?:receipt\s*(?:no|number|id|#))\s*[:.\-]?\s*([A-Z0-9]{6,24})/i,
      ];
      for (const p of txPatterns) {
        const m = cleaned.match(p);
        if (m) {
          let code = m[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
          // Prefer keeping FT prefix when present; otherwise save as plain transaction number
          if (code.length >= 6) {
            setFtNumber(code);
            break;
          }
        }
      }
    }

    // --- Amount ---
    if (!opts.skipAmount) {
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
    }

    // --- Sender ---
    const senderPatterns = [
      /(?:has\s+been\s+)?debited\s+from\s+([A-Za-z][A-Za-z\s.'-]{2,50}?)(?:\s+ETB|\s+on\s|\s+for\s|\n|$)/i,
      /(?:from|sender|payer)\s*[:.\s]+([A-Za-z][A-Za-z\s.'-]{2,40})/i,
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

    // --- Receiver ---
    const receiverPatterns = [
      /\bfor\s+([A-Za-z][A-Za-z0-9\s.&'\/-]{2,60}?)(?:\s+ETB-|\s+on\s|\s+with\s|\n|$)/i,
      /(?:to|receiver|beneficiary|credited\s+to)\s*[:.\s]+([A-Za-z][A-Za-z0-9\s.&'\/-]{2,50})/i,
    ];
    for (const p of receiverPatterns) {
      const m = cleaned.match(p);
      if (m) {
        let name = m[1].replace(/\s+/g, " ").trim();
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
    setFieldsLocked(true);
    setError("");
    openCamera();
  }

  function onFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      stopCamera();
      setImagePreview(dataUrl);
      processReceiptImage(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  /** Shrink receipt image so POST body stays under Vercel limits (~4MB) */
  async function compressImageForUpload(dataUrl: string, maxSide = 1280, quality = 0.72): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (ftExists) {
      setError("FT number already exists in the system");
      return;
    }
    if (!ftNumber.trim()) {
      setError("FT / transaction number is required");
      return;
    }
    if (!tableNumber.trim()) {
      setError("Table number is required");
      return;
    }
    if (!waiterId) {
      setError("Please select a waiter");
      return;
    }
    const total = parseFloat(totalAmount) || 0;
    const r = parseFloat(restaurant) || 0;
    const c = parseFloat(cafe) || 0;
    const b = parseFloat(butchery) || 0;
    const t = parseFloat(tip) || 0;
    if (total <= 0) {
      setError("Total amount is required");
      return;
    }
    if (Math.abs(r + c + b + t - total) > 0.01) {
      setError(
        `Sum (${(r + c + b + t).toFixed(2)}) must equal scanned amount (${total.toFixed(2)})`
      );
      return;
    }
    setSubmitting(true);
    try {
      let imagePayload: string | undefined = undefined;
      if (imagePreview) {
        imagePayload = await compressImageForUpload(imagePreview);
        // If still huge (>2.5MB base64), drop image rather than fail the save
        if (imagePayload.length > 2.5 * 1024 * 1024) {
          imagePayload = await compressImageForUpload(imagePreview, 800, 0.55);
        }
        if (imagePayload.length > 2.5 * 1024 * 1024) {
          console.warn("Image still too large, saving without image");
          imagePayload = undefined;
        }
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ftNumber: ftNumber.trim(),
          totalAmount: total,
          restaurantAmount: r,
          cafeAmount: c,
          butcheryAmount: b,
          tip: t,
          senderName: senderName || "",
          receiverName: receiverName || "",
          imageData: imagePayload,
          tableNumber: tableNumber.trim(),
          waiterId,
          waiterName,
        }),
      });

      let data: { error?: string; transaction?: { ftNumber: string } } = {};
      try {
        data = await res.json();
      } catch {
        // non-JSON response (often body size / server crash)
        setError(
          res.status === 413 || res.status === 500
            ? "Server rejected the request (image may be too large). Try again — photo will be compressed more."
            : `Server error (${res.status}). Please try again.`
        );
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || `Failed to save (${res.status})`);
        setSubmitting(false);
        return;
      }

      setSuccess(
        `Transaction saved! FT: ${data.transaction?.ftNumber || ftNumber} — Auditor has been notified.`
      );
      setFtNumber("");
      setTotalAmount("");
      setRestaurant("");
      setCafe("");
      setButchery("");
      setTip("");
      setSenderName("");
      setReceiverName("");
      setTableNumber("");
      setWaiterId("");
      setWaiterName("");
      setImagePreview(null);
      setFtExists(false);
      setFieldsLocked(true);
      stopCamera();
    } catch (err) {
      console.error("Submit error:", err);
      setError(
        "Network error — check your connection, or the receipt image is too large. Unlock, clear photo with Retake, and try again without a photo if needed."
      );
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

            {/* Start camera / upload */}
            {!cameraOpen && !imagePreview && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                <label
                  className="btn btn-outline"
                  style={{
                    width: "100%",
                    padding: "0.85rem",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  🖼️ Upload screenshot from gallery
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onFileUpload}
                    style={{ display: "none" }}
                  />
                </label>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)", textAlign: "center" }}>
                  Tip: focus on the QR code, or upload a clear screenshot from the CBE app.
                </p>
              </div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", flex: 1 }}>
                {fieldsLocked
                  ? "Filled automatically from QR / OCR. If FT is missing in the picture, unlock and type the transaction number."
                  : "Fields unlocked — type the FT or transaction number from the receipt, then submit."}
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setFieldsLocked((v) => !v)}
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem", whiteSpace: "nowrap" }}
              >
                {fieldsLocked ? "🔓 Unlock to edit" : "🔒 Lock fields"}
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <label className="label">FT / Transaction Number *</label>
                <input
                  className="input"
                  value={ftNumber}
                  readOnly={fieldsLocked}
                  onChange={(e) => setFtNumber(e.target.value.toUpperCase())}
                  placeholder={fieldsLocked ? "Auto-filled from scan" : "e.g. FT26282YJPPN or transaction number"}
                  required
                  style={{
                    background: fieldsLocked ? "#f1f5f9" : undefined,
                    cursor: fieldsLocked ? "not-allowed" : undefined,
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
                  readOnly={fieldsLocked}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder={fieldsLocked ? "Auto-filled from scan" : "0.00"}
                  required
                  style={{ background: fieldsLocked ? "#f1f5f9" : undefined, cursor: fieldsLocked ? "not-allowed" : undefined }}
                />
              </div>
              <div>
                <label className="label">Sender Name</label>
                <input
                  className="input"
                  value={senderName}
                  readOnly={fieldsLocked}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder={fieldsLocked ? "Auto-filled from scan" : "Sender name"}
                  style={{ background: fieldsLocked ? "#f1f5f9" : undefined, cursor: fieldsLocked ? "not-allowed" : undefined }}
                />
              </div>
              <div>
                <label className="label">Receiver Account Name</label>
                <input
                  className="input"
                  value={receiverName}
                  readOnly={fieldsLocked}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder={fieldsLocked ? "Auto-filled from scan" : "Receiver name"}
                  style={{ background: fieldsLocked ? "#f1f5f9" : undefined, cursor: fieldsLocked ? "not-allowed" : undefined }}
                />
              </div>
            </div>
          </div>

          {/* Table & Waiter */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Table &amp; Waiter</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <label className="label">Table Number *</label>
                <input
                  className="input"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 12"
                  required
                />
              </div>
              <div>
                <label className="label">Waiter *</label>
                <select
                  className="input"
                  value={waiterId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setWaiterId(id);
                    const w = waiters.find((x) => x.id === id);
                    setWaiterName(w?.fullName || "");
                  }}
                  required
                >
                  <option value="">Select waiter…</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.fullName}
                    </option>
                  ))}
                </select>
                {waiters.length === 0 && (
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0.35rem 0 0" }}>
                    No waiters found. Admin must register users with role &quot;waiter&quot;.
                  </p>
                )}
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
            disabled={submitting || ftExists || !balanced || !ftNumber || !totalAmount || !tableNumber || !waiterId}
          >
            {submitting ? "Saving…" : "Submit Transaction"}
          </button>
        </form>
      </main>
    </div>
  );
}
