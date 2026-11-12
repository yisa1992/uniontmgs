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

  // Costs (purchases made during the day)
  const [showCosts, setShowCosts] = useState(false);
  const [costs, setCosts] = useState<
    {
      id: string;
      name: string;
      unitPrice: number;
      quantity: number;
      total: number;
      createdAt?: string;
    }[]
  >([]);
  const [costName, setCostName] = useState("");
  const [costUnitPrice, setCostUnitPrice] = useState("");
  const [costQty, setCostQty] = useState("1");
  const [costSaving, setCostSaving] = useState(false);
  const [costMsg, setCostMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [costsLoading, setCostsLoading] = useState(false);

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

  const loadCosts = useCallback(async () => {
    setCostsLoading(true);
    try {
      const res = await fetch("/api/costs");
      if (res.ok) {
        const d = await res.json();
        setCosts(d.costs || []);
      }
    } catch {
      // ignore
    } finally {
      setCostsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showCosts) loadCosts();
  }, [showCosts, loadCosts]);

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault();
    setCostMsg(null);
    const name = costName.trim();
    const unitPrice = parseFloat(costUnitPrice) || 0;
    const quantity = parseFloat(costQty) || 0;
    if (!name) {
      setCostMsg({ type: "err", text: "Enter item name" });
      return;
    }
    if (unitPrice < 0 || quantity <= 0) {
      setCostMsg({ type: "err", text: "Enter valid unit price and quantity" });
      return;
    }
    setCostSaving(true);
    try {
      const res = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unitPrice, quantity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCostMsg({ type: "err", text: data.error || "Failed to save cost" });
        setCostSaving(false);
        return;
      }
      setCosts((prev) => [data.cost, ...prev]);
      setCostName("");
      setCostUnitPrice("");
      setCostQty("1");
      setCostMsg({
        type: "ok",
        text: `Saved: ${name} × ${quantity} = ${(unitPrice * quantity).toFixed(2)} ETB`,
      });
    } catch {
      setCostMsg({ type: "err", text: "Network error — try again" });
    } finally {
      setCostSaving(false);
    }
  }

  async function handleDeleteCost(id: string) {
    if (!confirm("Delete this cost?")) return;
    try {
      const res = await fetch(`/api/costs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCosts((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      // ignore
    }
  }

  const costsTotal = costs.reduce((s, c) => s + (Number(c.total) || 0), 0);

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
      // Prefer rear camera at the highest resolution the device allows
      const tryConstraints: MediaStreamConstraints[] = [
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 4032 },
            height: { ideal: 3024 },
          },
        },
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
        },
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        {
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        },
      ];

      let stream: MediaStream | null = null;
      let lastErr: unknown = null;
      for (const constraints of tryConstraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!stream) throw lastErr || new Error("Camera unavailable");

      // Push track to maximum supported resolution when possible
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps =
            typeof track.getCapabilities === "function"
              ? track.getCapabilities()
              : ({} as MediaTrackCapabilities);
          const req: MediaTrackConstraints = {};
          if (caps.width?.max) req.width = { ideal: caps.width.max };
          if (caps.height?.max) req.height = { ideal: caps.height.max };
          if (Object.keys(req).length) {
            await track.applyConstraints(req);
          }
        } catch {
          // ignore — some browsers reject max constraints
        }
      }

      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
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

  /** Grab a still frame at the best quality available (ImageCapture when supported). */
  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let dataUrl: string | null = null;

    // 1) Prefer ImageCapture — true still photo at sensor resolution (not video frame)
    try {
      const track = streamRef.current?.getVideoTracks()?.[0];
      // ImageCapture is available on Chrome/Android; typed loosely for TS
      const ImageCaptureCtor = (window as unknown as {
        ImageCapture?: new (t: MediaStreamTrack) => {
          takePhoto: (opts?: { imageWidth?: number; imageHeight?: number }) => Promise<Blob>;
          getPhotoCapabilities?: () => Promise<{
            imageWidth?: { min: number; max: number };
            imageHeight?: { min: number; max: number };
          }>;
        };
      }).ImageCapture;
      if (track && ImageCaptureCtor) {
        const ic = new ImageCaptureCtor(track);
        let opts: { imageWidth?: number; imageHeight?: number } | undefined;
        try {
          if (typeof ic.getPhotoCapabilities === "function") {
            const caps = await ic.getPhotoCapabilities();
            if (caps.imageWidth?.max && caps.imageHeight?.max) {
              opts = {
                imageWidth: caps.imageWidth.max,
                imageHeight: caps.imageHeight.max,
              };
            }
          }
        } catch {
          /* optional */
        }
        const blob = await ic.takePhoto(opts);
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn("ImageCapture failed, falling back to video frame", e);
    }

    // 2) Fallback: capture current video frame at full stream resolution
    if (!dataUrl) {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // High-quality resampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, 0, 0, w, h);
      // Near-lossless JPEG for on-screen preview & OCR
      dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    }

    stopCamera();
    // Full-quality image is shown in the app after shoot
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
          "FT / transaction number not found in the picture. You can leave it empty (auto-generated) or type it from the receipt."
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

  /** Shrink receipt image for upload only (preview stays full quality). Keep readable for later review. */
  async function compressImageForUpload(dataUrl: string, maxSide = 1920, quality = 0.85): Promise<string> {
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
    // FT is optional — only block if user entered one that already exists
    if (ftNumber.trim() && ftExists) {
      setError("FT number already exists in the system");
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
          imagePayload = await compressImageForUpload(imagePreview, 1280, 0.72);
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #f0fdf4 40%, #f8fafc 100%)" }}>
      <Navbar user={user} />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "1.75rem 1.25rem 3rem" }}>
        {/* Attractive header */}
        <div
          style={{
            marginBottom: "1.75rem",
            padding: "1.5rem 1.75rem",
            borderRadius: 20,
            background: "linear-gradient(135deg, #065f46 0%, #047857 40%, #0d9488 100%)",
            color: "white",
            boxShadow: "0 10px 40px rgba(6, 95, 70, 0.25)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -30, right: -20, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", bottom: -40, left: 40, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", position: "relative" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.65rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
                📸 New Transaction
              </h1>
              <p style={{ margin: "0.4rem 0 0", opacity: 0.9, fontSize: "0.95rem" }}>
                Scan the receipt QR or photo — everything fills in automatically. Just confirm the split &amp; submit.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowCosts((v) => !v)}
                style={{
                  background: showCosts ? "#fef3c7" : "#fff",
                  color: "#92400e",
                  border: showCosts ? "2px solid #f59e0b" : "none",
                  borderRadius: 12,
                  padding: "0.75rem 1.2rem",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                  flexShrink: 0,
                }}
              >
                🧾 Costs
              </button>
              <button
                type="button"
                onClick={() => router.push("/cashier/report")}
                style={{
                  background: "#fff",
                  color: "#065f46",
                  border: "none",
                  borderRadius: 12,
                  padding: "0.75rem 1.2rem",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                  flexShrink: 0,
                }}
              >
                📊 Today&apos;s Report
              </button>
            </div>
          </div>
        </div>

        {/* Costs panel */}
        {showCosts && (
          <div
            style={{
              marginBottom: "1.25rem",
              padding: "1.25rem 1.35rem",
              borderRadius: 16,
              border: "2px solid #fbbf24",
              background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
              boxShadow: "0 4px 20px rgba(245, 158, 11, 0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#92400e" }}>
                🧾 Daily Costs / Purchases
              </h2>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#b45309" }}>
                Total: {costsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
              </span>
            </div>
            <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#78350f" }}>
              Add items bought during the day (name, unit price × quantity). These costs go to the auditor at sales closing.
            </p>

            <form
              onSubmit={handleAddCost}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr auto",
                gap: 10,
                marginBottom: "1rem",
                alignItems: "end",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#78350f", marginBottom: 4 }}>
                  Item name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cooking oil"
                  value={costName}
                  onChange={(e) => setCostName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #fcd34d",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#78350f", marginBottom: 4 }}>
                  Unit price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={costUnitPrice}
                  onChange={(e) => setCostUnitPrice(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #fcd34d",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#78350f", marginBottom: 4 }}>
                  Quantity
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  placeholder="1"
                  value={costQty}
                  onChange={(e) => setCostQty(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #fcd34d",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={costSaving}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: costSaving ? "#d1d5db" : "#d97706",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: costSaving ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {costSaving ? "Saving…" : "Add cost"}
              </button>
            </form>

            {(parseFloat(costUnitPrice) > 0 || parseFloat(costQty) > 0) && (
              <p style={{ margin: "0 0 0.75rem", fontSize: 13, color: "#92400e", fontWeight: 700 }}>
                Line total:{" "}
                {(
                  (parseFloat(costUnitPrice) || 0) * (parseFloat(costQty) || 0)
                ).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ETB
              </p>
            )}

            {costMsg && (
              <div
                style={{
                  marginBottom: "0.75rem",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: costMsg.type === "ok" ? "#ecfdf5" : "#fef2f2",
                  color: costMsg.type === "ok" ? "#065f46" : "#991b1b",
                }}
              >
                {costMsg.text}
              </div>
            )}

            {costsLoading ? (
              <p style={{ color: "#92400e", fontSize: 13 }}>Loading costs…</p>
            ) : costs.length === 0 ? (
              <p style={{ color: "#a16207", fontSize: 13, margin: 0 }}>No costs added today yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#fde68a", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Name</th>
                      <th style={{ padding: "8px 10px" }}>Unit price</th>
                      <th style={{ padding: "8px 10px" }}>Qty</th>
                      <th style={{ padding: "8px 10px" }}>Total</th>
                      <th style={{ padding: "8px 10px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map((c) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #fde68a" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: "8px 10px" }}>
                          {Number(c.unitPrice).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td style={{ padding: "8px 10px" }}>{c.quantity}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 700 }}>
                          {Number(c.total).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          ETB
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteCost(c.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#dc2626",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Always-visible report shortcut (mobile-friendly) */}
        <button
          type="button"
          onClick={() => router.push("/cashier/report")}
          style={{
            width: "100%",
            marginBottom: "1.25rem",
            padding: "1rem 1.25rem",
            borderRadius: 14,
            border: "2px solid #0f766e",
            background: "linear-gradient(135deg, #ecfdf5 0%, #ccfbf1 100%)",
            color: "#065f46",
            fontWeight: 800,
            fontSize: "1.05rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.6rem",
            boxShadow: "0 4px 16px rgba(15, 118, 110, 0.15)",
          }}
        >
          <span style={{ fontSize: "1.25rem" }}>📊</span>
          Today&apos;s Report — view &amp; edit transactions
        </button>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem", borderRadius: 12 }}>
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: "1rem", borderRadius: 12 }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Camera / photo section */}
          <div
            className="card"
            style={{
              padding: "1.5rem",
              marginBottom: "1.25rem",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
            }}
          >
            <label className="label" style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
              📷 QR Code / Receipt Photo
            </label>
            <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "var(--muted)" }}>
              Capture the QR code or receipt. The image is saved with the transaction and used for auto-fill.
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
                    maxHeight: 560,
                    minHeight: 280,
                    borderRadius: 12,
                    background: "#000",
                    objectFit: "contain",
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
                    width: "100%",
                    maxHeight: 560,
                    objectFit: "contain",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    display: "block",
                    background: "#0f172a",
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

          {/* Scanned summary — FT / names auto-filled in background from QR/OCR (no input boxes) */}
          <div
            className="card"
            style={{
              padding: "1.5rem",
              marginBottom: "1.25rem",
              background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)",
              border: "1px solid #a7f3d0",
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(16, 185, 129, 0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#065f46" }}>
                  ✨ Scanned Details
                </h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#047857" }}>
                  FT number is optional (auto-filled from photo/QR if found). Table, waiter, and amounts are required.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setFieldsLocked((v) => !v)}
                style={{
                  fontSize: "0.8rem",
                  padding: "0.4rem 0.85rem",
                  whiteSpace: "nowrap",
                  borderRadius: 10,
                  borderColor: "#6ee7b7",
                  color: "#065f46",
                }}
              >
                {fieldsLocked ? "🔓 Unlock amount" : "🔒 Lock amount"}
              </button>
            </div>

            {/* FT status badge (read-only display, not an input) */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  flex: "1 1 180px",
                  padding: "0.85rem 1rem",
                  borderRadius: 12,
                  background: ftNumber
                    ? ftExists
                      ? "linear-gradient(135deg, #fef2f2, #fee2e2)"
                      : "linear-gradient(135deg, #ecfdf5, #d1fae5)"
                    : "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                  border: `1px solid ${ftNumber ? (ftExists ? "#fca5a5" : "#6ee7b7") : "#e2e8f0"}`,
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", marginBottom: 4 }}>
                  FT / Transaction #
                </div>
                <div
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    color: ftExists ? "#b91c1c" : ftNumber ? "#065f46" : "#94a3b8",
                    letterSpacing: "0.02em",
                  }}
                >
                  {ftNumber || "Optional — auto if empty"}
                </div>
                {ftExists && (
                  <p style={{ color: "#b91c1c", fontSize: "0.75rem", margin: "0.35rem 0 0", fontWeight: 600 }}>
                    ⚠ This FT already exists
                  </p>
                )}
              </div>

              {(senderName || receiverName) && (
                <div
                  style={{
                    flex: "1 1 180px",
                    padding: "0.85rem 1rem",
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #eff6ff, #e0f2fe)",
                    border: "1px solid #93c5fd",
                  }}
                >
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", marginBottom: 4 }}>
                    Parties
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#1e40af", lineHeight: 1.4 }}>
                    {senderName && <div><span style={{ opacity: 0.7 }}>From:</span> <strong>{senderName}</strong></div>}
                    {receiverName && <div><span style={{ opacity: 0.7 }}>To:</span> <strong>{receiverName}</strong></div>}
                  </div>
                </div>
              )}
            </div>

            {/* Only Total Amount remains as editable input */}
            <div>
              <label className="label" style={{ color: "#065f46", fontWeight: 600 }}>
                Total Amount (ETB) *
              </label>
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
                style={{
                  background: fieldsLocked ? "#f0fdf4" : "#fff",
                  cursor: fieldsLocked ? "not-allowed" : undefined,
                  borderRadius: 12,
                  border: "1px solid #6ee7b7",
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  padding: "0.85rem 1rem",
                  color: "#065f46",
                }}
              />
            </div>
          </div>

          {/* Table & Waiter */}
          <div
            className="card"
            style={{
              padding: "1.5rem",
              marginBottom: "1.25rem",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ margin: "0 0 1.15rem", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
              🪑 Table &amp; Waiter
            </h3>
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
                  style={{ borderRadius: 12, padding: "0.75rem 1rem" }}
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
                  style={{ borderRadius: 12, padding: "0.75rem 1rem" }}
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
          <div
            className="card"
            style={{
              padding: "1.5rem",
              marginBottom: "1.5rem",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ margin: "0 0 1.15rem", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
              💰 Split Amounts
            </h3>
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
                  style={{ borderRadius: 12, padding: "0.75rem 1rem" }}
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
                  style={{ borderRadius: 12, padding: "0.75rem 1rem" }}
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
                  style={{ borderRadius: 12, padding: "0.75rem 1rem" }}
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
                  style={{ background: "#f8fafc", borderRadius: 12, padding: "0.75rem 1rem" }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: "1.35rem",
                padding: "1rem 1.15rem",
                borderRadius: 12,
                background: balanced
                  ? "linear-gradient(135deg, #ecfdf5, #d1fae5)"
                  : "linear-gradient(135deg, #fffbeb, #fef3c7)",
                border: `1px solid ${balanced ? "#6ee7b7" : "#fcd34d"}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.95rem",
                boxShadow: balanced ? "0 2px 12px rgba(16,185,129,0.12)" : "none",
              }}
            >
              <span>
                Sum: <strong>{sum.toFixed(2)}</strong> / Total:{" "}
                <strong>{total.toFixed(2)}</strong>
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: balanced ? "#065f46" : "#b45309",
                  fontSize: "0.9rem",
                }}
              >
                {balanced ? "✓ Balanced" : "⚠ Must equal total"}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-success"
            style={{
              width: "100%",
              padding: "1.1rem 1.5rem",
              fontSize: "1.1rem",
              fontWeight: 700,
              borderRadius: 14,
              background: submitting || (ftNumber.trim() && ftExists) || !balanced || !totalAmount || !tableNumber || !waiterId
                ? undefined
                : "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)",
              boxShadow: submitting || (ftNumber.trim() && ftExists) || !balanced || !totalAmount || !tableNumber || !waiterId
                ? "none"
                : "0 8px 28px rgba(16, 185, 129, 0.35)",
              border: "none",
              letterSpacing: "0.01em",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            disabled={submitting || (!!ftNumber.trim() && ftExists) || !balanced || !totalAmount || !tableNumber || !waiterId}
          >
            {submitting ? "Saving…" : "✓ Submit Transaction"}
          </button>
        </form>
      </main>
    </div>
  );
}
