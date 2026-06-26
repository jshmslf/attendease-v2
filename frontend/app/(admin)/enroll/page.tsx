"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api, StudentResponse } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_PHOTOS = 5;

interface CaptureItem {
  blob: Blob;
  url: string;
}

interface EnrollResult {
  successCount: number;
  errors: string[];
}

interface TrainResult {
  success: boolean;
  message: string;
  failed?: string[];
}

function EnrollContent() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("id") ?? "";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentResponse | null>(null);
  const [search, setSearch] = useState(preselectedId);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState<EnrollResult | null>(null);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<TrainResult | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadStudents();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (preselectedId && students.length > 0) {
      const match = students.find((s) => s.student_id === preselectedId);
      if (match) selectStudent(match);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedId, students]);

  async function loadStudents() {
    try {
      const data = await api.getStudents();
      setStudents(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function selectStudent(student: StudentResponse) {
    setSelectedStudent(student);
    setSearch(student.student_id);
    setCaptures([]);
    setEnrollResult(null);
    setTrainResult(null);
    try {
      const res = await api.getStudentPhotos(student.student_id);
      setExistingPhotos(res.photos ?? []);
    } catch {
      setExistingPhotos([]);
    }
  }

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings and reload.");
      } else if (e.name === "NotFoundError") {
        setCameraError("No camera found. Please connect a webcam and try again.");
      } else {
        setCameraError(`Camera error: ${e.message}`);
      }
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    if (captures.length >= MAX_PHOTOS) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setCaptures((prev) => [...prev, { blob, url }]);
      },
      "image/jpeg",
      0.92
    );
  }

  function removeCapture(index: number) {
    setCaptures((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].url);
      copy.splice(index, 1);
      return copy;
    });
  }

  async function handleEnrollAll() {
    if (!selectedStudent || captures.length === 0) return;
    setEnrolling(true);
    setEnrollResult(null);

    let successCount = 0;
    const errors: string[] = [];

    for (const { blob } of captures) {
      const formData = new FormData();
      formData.append("image", blob, "face.jpg");
      try {
        await api.enrollFace(selectedStudent.student_id, formData);
        successCount++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "Unknown error");
      }
    }

    setEnrollResult({ successCount, errors });
    if (successCount > 0) {
      try {
        const res = await api.getStudentPhotos(selectedStudent.student_id);
        setExistingPhotos(res.photos ?? []);
      } catch { /* ignore */ }
      setCaptures([]);
    }
    setEnrolling(false);
  }

  async function handleDeletePhoto(photoUrl: string) {
    const filename = photoUrl.split("/").pop();
    if (!filename || !selectedStudent) return;
    setDeletingPhoto(filename);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${BASE}/api/students/${selectedStudent.student_id}/photos/${filename}`,
        { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error("Delete failed");
      setExistingPhotos((prev) => prev.filter((p) => p !== photoUrl));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingPhoto(null);
    }
  }

  async function handleTrain() {
    setTraining(true);
    setTrainResult(null);
    try {
      const result = await api.trainModel();
      setTrainResult({ success: true, message: result.message, failed: result.failed });
    } catch (err) {
      setTrainResult({ success: false, message: err instanceof Error ? err.message : "Training failed" });
    } finally {
      setTraining(false);
    }
  }

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.student_id.toLowerCase().includes(q) ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Face Enrollment</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Capture student face photos via webcam. Enrolling multiple angles improves recognition accuracy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left panel - Student selector */}
        <div className="lg:col-span-2">
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search student ID or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", paddingRight: search ? "2rem" : undefined }}
                />
                {search && (
                  <button
                    onClick={() => { setSearch(""); setSelectedStudent(null); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "480px" }}>
              {filteredStudents.length === 0 ? (
                <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-secondary)" }}>No students found.</p>
              ) : (
                filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectStudent(s)}
                    className="w-full px-4 py-3 text-left transition-all"
                    style={{
                      background: selectedStudent?.id === s.id ? "#1DB95420" : "transparent",
                      borderLeft: selectedStudent?.id === s.id ? "2px solid var(--accent)" : "2px solid transparent",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {s.first_name} {s.last_name}
                    </div>
                    <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      <span className="font-mono">{s.student_id}</span>
                      {s.has_face_enrolled ? (
                        <span className="text-emerald-400">● Enrolled</span>
                      ) : (
                        <span className="text-amber-400">● Not enrolled</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right panel - Webcam capture */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedStudent ? (
            <div className="rounded-xl flex items-center justify-center"
              style={{ height: "360px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--text-secondary)" }} className="text-sm">Select a student to begin enrollment</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: "var(--accent)" }}>
                  {selectedStudent.first_name[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {selectedStudent.student_id} · {selectedStudent.course}
                  </div>
                </div>
                {existingPhotos.length > 0 && (
                  <div className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>
                    {existingPhotos.length} photo{existingPhotos.length !== 1 ? "s" : ""} enrolled
                  </div>
                )}
              </div>

              <div className="rounded-xl overflow-hidden relative"
                style={{ background: "#000", border: "1px solid var(--border)", aspectRatio: "4/3" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ display: cameraActive ? "block" : "none", transform: "scaleX(-1)" }}
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: "var(--bg-surface)" }}>
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        style={{ color: "var(--text-secondary)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    {cameraError ? (
                      <div className="text-center px-6">
                        <p className="text-sm text-red-400 mb-3">{cameraError}</p>
                        <button onClick={startCamera}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                          style={{ background: "var(--accent)" }}>
                          Try Again
                        </button>
                      </div>
                    ) : (
                      <button onClick={startCamera}
                        className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
                        style={{ background: "var(--accent)" }}>
                        Start Camera
                      </button>
                    )}
                    <p className="text-xs px-6 text-center" style={{ color: "var(--text-secondary)" }}>
                      Your browser will ask for camera permission. This is required for face enrollment.
                    </p>
                  </div>
                )}
                {cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {/* Dimmed surround */}
                    <div className="absolute inset-0" style={{
                      background: "radial-gradient(ellipse 42% 52% at 50% 46%, transparent 100%, rgba(0,0,0,0.55) 100%)",
                    }} />
                    {/* Face oval guide */}
                    <div style={{
                      width: "42%",
                      paddingBottom: "52%",
                      position: "relative",
                      marginBottom: "8%",
                    }}>
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        border: `3px dashed ${captures.length >= MAX_PHOTOS ? "#22c55e" : "rgba(255,255,255,0.75)"}`,
                        boxShadow: captures.length >= MAX_PHOTOS ? "0 0 0 1px #22c55e40 inset" : "0 0 0 1px rgba(255,255,255,0.1) inset",
                        transition: "border-color 0.3s, box-shadow 0.3s",
                      }} />
                      {/* Corner ticks */}
                      {[["0%","0%","1.5px","12px","12px","1.5px"],["100%","0%","1.5px","12px","-12px","1.5px"],
                        ["0%","100%","1.5px","12px","12px","-1.5px"],["100%","100%","1.5px","12px","-12px","-1.5px"]
                      ].map(([r,b,bw,bh,tx,ty],i)=>(<div key={i} style={{
                        position:"absolute",right:r,bottom:b,width:bh,height:bh,
                        borderRight:i%2===0?"none":`${bw} solid white`,
                        borderLeft:i%2===0?`${bw} solid white`:"none",
                        borderTop:i<2?`${bw} solid white`:"none",
                        borderBottom:i>=2?`${bw} solid white`:"none",
                        transform:`translate(${tx},${ty})`,borderRadius:"2px",opacity:0.9
                      }}/>))}
                    </div>
                    {/* Label */}
                    <div style={{
                      position: "absolute",
                      bottom: "5rem",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(0,0,0,0.5)",
                      backdropFilter: "blur(4px)",
                      borderRadius: "999px",
                      padding: "4px 14px",
                      fontSize: "11px",
                      color: captures.length >= MAX_PHOTOS ? "#86efac" : "rgba(255,255,255,0.85)",
                      whiteSpace: "nowrap",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}>
                      {captures.length >= MAX_PHOTOS ? "Max photos reached" : "Center your face inside the oval"}
                    </div>
                  </div>
                )}

                {cameraActive && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                    <button onClick={capturePhoto}
                      disabled={captures.length >= MAX_PHOTOS}
                      className="px-5 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg transition-transform active:scale-95"
                      style={{
                        background: captures.length >= MAX_PHOTOS ? "#6b728080" : "var(--accent)",
                        cursor: captures.length >= MAX_PHOTOS ? "not-allowed" : "pointer",
                      }}>
                      Capture ({captures.length}/{MAX_PHOTOS})
                    </button>
                    <button onClick={stopCamera}
                      className="px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg"
                      style={{ background: "#1f2937", color: "var(--text-secondary)" }}>
                      Stop
                    </button>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {captures.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                    Captured photos - will be enrolled
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {captures.map(({ url }, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Capture ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-lg"
                          style={{ border: "2px solid var(--accent)" }} />
                        <button
                          onClick={() => removeCapture(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center"
                          style={{ background: "#ef4444" }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingPhotos.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                    Currently enrolled photos
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {existingPhotos.map((url, i) => {
                      const filename = url.split("/").pop()!;
                      return (
                        <div key={i} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`${API_URL}${url}`} alt={`Enrolled ${i + 1}`}
                            className="w-16 h-16 object-cover rounded-lg"
                            style={{
                              border: "1px solid var(--border)",
                              opacity: deletingPhoto === filename ? 0.3 : 0.85,
                              transition: "opacity 0.2s",
                            }} />
                          <button
                            onClick={() => handleDeletePhoto(url)}
                            disabled={!!deletingPhoto}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center"
                            style={{ background: "#ef4444", cursor: deletingPhoto ? "not-allowed" : "pointer" }}
                          >
                            {deletingPhoto === filename ? "·" : "✕"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {enrollResult && (
                <div className="rounded-lg px-4 py-3 text-sm"
                  style={{
                    background: enrollResult.successCount > 0 ? "#22c55e15" : "#ef444415",
                    border: `1px solid ${enrollResult.successCount > 0 ? "#22c55e30" : "#ef444430"}`,
                    color: enrollResult.successCount > 0 ? "#86efac" : "#fca5a5",
                  }}>
                  {enrollResult.successCount > 0
                    ? `${enrollResult.successCount} photo${enrollResult.successCount !== 1 ? "s" : ""} enrolled successfully.`
                    : "Enrollment failed."}
                  {enrollResult.errors.length > 0 && (
                    <ul className="mt-1 text-xs opacity-80">
                      {enrollResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {trainResult && (
                <div className="rounded-lg px-4 py-3 text-sm"
                  style={{
                    background: trainResult.success ? "#1DB95415" : "#ef444415",
                    border: `1px solid ${trainResult.success ? "#1DB95430" : "#ef444430"}`,
                    color: trainResult.success ? "#86efac" : "#fca5a5",
                  }}>
                  {trainResult.message}
                  {trainResult.failed && trainResult.failed.length > 0 && (
                    <p className="text-xs mt-1 opacity-80">Failed: {trainResult.failed.join(", ")}</p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleEnrollAll}
                  disabled={captures.length === 0 || enrolling}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity"
                  style={{
                    background: captures.length === 0 || enrolling ? "#1DB95450" : "var(--accent)",
                    cursor: captures.length === 0 || enrolling ? "not-allowed" : "pointer",
                  }}>
                  {enrolling ? "Enrolling..." : `Enroll ${captures.length} Photo${captures.length !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={handleTrain}
                  disabled={training}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    color: training ? "var(--text-secondary)" : "var(--text-primary)",
                    cursor: training ? "not-allowed" : "pointer",
                  }}>
                  {training ? "Training..." : "Re-train Model"}
                </button>
              </div>

              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Tip: Capture 3–5 photos from slightly different angles for better recognition accuracy.
                Click &quot;Re-train Model&quot; after enrolling multiple students to average all their photos.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EnrollPage() {
  return (
    <Suspense>
      <EnrollContent />
    </Suspense>
  );
}
