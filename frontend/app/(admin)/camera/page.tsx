"use client";

import { useRef, useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CAMERA_API_KEY = "attendease-camera-secret-key";
const INTERVAL_MS = 2000;

interface FaceResult {
  recognized: boolean;
  student_id: string | null;
  student_name: string | null;
  confidence: number;
  attendance_marked: boolean;
  already_marked_today: boolean;
  status: string | null;
  face_location: [number, number, number, number] | null; // [top, right, bottom, left]
}

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);
  const cameraIdRef = useRef("browser-camera");

  const [running, setRunning] = useState(false);
  const [lastEvent, setLastEvent] = useState<FaceResult | null>(null);
  const [statusText, setStatusText] = useState("Camera stopped");
  const [error, setError] = useState("");
  const [cameraId, setCameraId] = useState("browser-camera");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    cameraIdRef.current = cameraId;
  }, [cameraId]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  function drawBoxes(results: FaceResult[]) {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cw = canvas.width;
    for (const r of results) {
      if (!r.face_location) continue;
      const [top, right, bottom, left] = r.face_location;

      // Mirror x-coords to match the CSS-flipped video; text is drawn at mLeft so it reads normally
      const mLeft = cw - right;
      const mRight = cw - left;

      let color = "#dc3c3c";
      if (r.recognized && !r.already_marked_today) color = "#32cd32";
      else if (r.recognized && r.already_marked_today) color = "#00c8c8";

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(mLeft, top, mRight - mLeft, bottom - top);

      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = color;
      if (r.recognized) {
        const status = (r.status || "").toUpperCase();
        const label = r.already_marked_today
          ? `${r.student_name} [Already Marked]`
          : `${r.student_name} - ${status}`;
        ctx.fillText(label, mLeft, Math.max(top - 12, 20));
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#aaa";
        ctx.fillText(`${(r.confidence * 100).toFixed(0)}%`, mLeft, Math.max(top - 32, 14));
      } else {
        ctx.fillText("Unknown", mLeft, Math.max(top - 12, 20));
      }
    }
  }

  async function captureAndRecognize() {
    if (sendingRef.current) return;
    const video = videoRef.current;
    const captureCanvas = captureCanvasRef.current;
    if (!video || !captureCanvas || video.readyState < 2) return;

    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const base64 = captureCanvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    sendingRef.current = true;
    setStatusText("Processing...");

    try {
      const res = await fetch(`${BASE}/api/camera/recognize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Camera-API-Key": CAMERA_API_KEY,
        },
        body: JSON.stringify({ frame_b64: base64, camera_id: cameraIdRef.current }),
      });

      if (res.ok) {
        const results: FaceResult[] = await res.json();
        drawBoxes(results);
        const fresh = results.find((r) => r.recognized && !r.already_marked_today);
        if (fresh) setLastEvent(fresh);
        setStatusText(results.length === 0 ? "Scanning..." : `${results.length} face(s) detected`);
      } else {
        setStatusText("Scanning...");
      }
    } catch {
      setStatusText("Scanning...");
    } finally {
      sendingRef.current = false;
    }
  }

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setRunning(true);
      setStatusText("Scanning...");
      intervalRef.current = setInterval(() => {
        captureAndRecognize();
      }, INTERVAL_MS);
    } catch {
      setError("Camera access denied or not available. Check browser permissions.");
    }
  }

  function stopCamera() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = overlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setRunning(false);
    setLastEvent(null);
    setStatusText("Camera stopped");
  }

  useEffect(() => {
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8 w-full">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Live Camera
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Browser-based attendance gate. Scans every 2 seconds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            placeholder="Camera ID"
            disabled={running}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              width: 160,
              opacity: running ? 0.5 : 1,
            }}
          />
          <button
            onClick={running ? stopCamera : startCamera}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              running
                ? { background: "#7f1d1d40", border: "1px solid #ef444440", color: "#fca5a5" }
                : { background: "linear-gradient(135deg, #1DB954, #158a3e)", color: "#fff", border: "none" }
            }
          >
            {running ? "Stop" : "Start Camera"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm text-red-300"
          style={{ background: "#7f1d1d30", border: "1px solid #ef444440" }}>
          {error}
        </div>
      )}

      {/* Camera feed */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden"
        style={{ aspectRatio: "16/9", background: "#000", border: "1px solid var(--border)" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Bounding box overlay - NOT CSS-mirrored; x-coords are flipped in drawBoxes */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        />

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 p-2 rounded-lg transition-all z-10"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", color: "#ccc" }}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>

        {/* Idle placeholder */}
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ color: "var(--text-secondary)" }}>
            <svg className="w-14 h-14 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-sm opacity-50">Click &ldquo;Start Camera&rdquo; to begin</span>
          </div>
        )}

        {/* Status bar */}
        <div
          className="absolute bottom-0 left-0 right-0 px-4 py-2.5 flex items-center justify-between"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        >
          {lastEvent ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="text-sm font-semibold" style={{ color: "#32cd32" }}>
                  {lastEvent.student_name} ({lastEvent.student_id})
                  {" - "}{(lastEvent.status || "").toUpperCase()}
                </span>
              </div>
              <span className="text-xs" style={{ color: "#888" }}>
                {(lastEvent.confidence * 100).toFixed(0)}% confidence
              </span>
            </>
          ) : (
            <span className="text-sm" style={{ color: "#888" }}>{statusText}</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#32cd32" }} />
          Attendance marked
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#00c8c8" }} />
          Already marked today
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#dc3c3c" }} />
          Unrecognized
        </div>
      </div>

      {/* Hidden capture canvas */}
      <canvas ref={captureCanvasRef} className="hidden" />
    </div>
  );
}
