"""
AttendEase Camera Gateway
=========================
Run this script on the machine connected to the entrance camera.
It captures frames, sends them to the FastAPI backend for recognition,
and shows a live 1280×720 preview with per-face bounding boxes.

Usage:
    python camera_gateway.py --camera 0 --api http://localhost:8000

Keyboard shortcuts (preview window):
    Q or ESC  - quit gracefully
    Ctrl+C    - force quit (headless / terminal)

Requirements:
    pip install opencv-python requests
"""

import cv2
import requests
import base64
import argparse
import time
import queue
import threading
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RECOGNITION_INTERVAL = 2.0
CAMERA_API_KEY = "attendease-camera-secret-key"

# Colors (BGR)
COLOR_MATCHED = (50, 205, 50)       # green - new attendance
COLOR_ALREADY = (200, 200, 0)       # cyan - already marked today
COLOR_UNKNOWN = (60, 60, 220)       # red - unrecognized


def encode_frame(frame) -> str:
    """Encode OpenCV frame to base64 JPEG string."""
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buffer).decode("utf-8")


def send_frame(frame_b64: str, camera_id: str, api_url: str) -> list | None:
    """Send frame to backend recognition endpoint; returns list of per-face results."""
    try:
        response = requests.post(
            f"{api_url}/api/camera/recognize",
            json={"frame_b64": frame_b64, "camera_id": camera_id},
            headers={"X-Camera-API-Key": CAMERA_API_KEY},
            timeout=10,
        )
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"API error {response.status_code}: {response.text}")
    except requests.exceptions.ConnectionError:
        logger.error("Cannot connect to backend. Is FastAPI running?")
    except requests.exceptions.Timeout:
        logger.error("Recognition request timed out.")
    return None


def recognition_worker(
    frame_queue: queue.Queue,
    result_queue: queue.Queue,
    camera_id: str,
    api_url: str,
) -> None:
    """
    Background thread: pulls frames from frame_queue, sends to API,
    pushes results to result_queue.
    """
    while True:
        frame = frame_queue.get()
        if frame is None:
            break

        frame_b64 = encode_frame(frame)
        results = send_frame(frame_b64, camera_id, api_url)

        try:
            result_queue.get_nowait()
        except queue.Empty:
            pass
        result_queue.put(results)

        if results:
            for r in results:
                if r.get("recognized") and r.get("attendance_marked"):
                    logger.info(
                        f"✓ Marked: {r['student_name']} "
                        f"({r['student_id']}) - {r['status']}"
                    )

        time.sleep(RECOGNITION_INTERVAL)


def draw_multi_overlay(frame, results: list | None):
    """Draw per-face bounding boxes and a bottom status bar on the frame."""
    frame = cv2.flip(frame, 1)  # mirror for display; text drawn after flip so it reads normally
    h, w = frame.shape[:2]

    cv2.putText(frame, "Q / ESC to quit", (10, 24),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 120, 120), 1)

    # Bottom status bar
    bar_y = h - 50
    cv2.rectangle(frame, (0, bar_y), (w, h), (0, 0, 0), -1)

    if not results:
        cv2.putText(frame, "Scanning...", (12, h - 18),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (200, 200, 200), 1)
        return frame

    last_event = None

    for r in results:
        loc = r.get("face_location")
        if not loc or len(loc) != 4:
            continue

        top, right, bottom, left = loc
        # Mirror x-coords to match flipped frame; text drawn at m_left reads normally
        m_left = w - right
        m_right = w - left
        recognized = r.get("recognized", False)
        already = r.get("already_marked_today", False)

        if recognized and not already:
            color = COLOR_MATCHED
        elif recognized and already:
            color = COLOR_ALREADY
        else:
            color = COLOR_UNKNOWN

        cv2.rectangle(frame, (m_left, top), (m_right, bottom), color, 2)

        if recognized:
            name = r.get("student_name", "")
            status = (r.get("status") or "").upper()
            confidence = r.get("confidence", 0)
            suffix = " [Already Marked]" if already else f" - {status}"
            label = f"{name}{suffix}"
            conf_label = f"{confidence:.0%}"

            cv2.putText(frame, label, (m_left, max(top - 10, 14)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
            cv2.putText(frame, conf_label, (m_left, max(top - 28, 14)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 180, 180), 1)

            if not already:
                last_event = r
        else:
            cv2.putText(frame, "Unknown", (m_left, max(top - 10, 14)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, COLOR_UNKNOWN, 2)

    # Status bar summary (most recently marked student)
    if last_event:
        name = last_event.get("student_name", "")
        sid = last_event.get("student_id", "")
        status = (last_event.get("status") or "").upper()
        conf = last_event.get("confidence", 0)
        cv2.putText(frame, f"{name} ({sid}) - {status}",
                    (12, h - 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, COLOR_MATCHED, 2)
        cv2.putText(frame, f"Confidence: {conf:.0%}",
                    (12, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (150, 150, 150), 1)
    else:
        faces_seen = len([r for r in results if r.get("recognized")])
        if faces_seen == 0 and results:
            cv2.putText(frame, "No match found", (12, h - 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, COLOR_UNKNOWN, 1)
        elif all(r.get("already_marked_today") for r in results if r.get("recognized")):
            cv2.putText(frame, "Already marked today", (12, h - 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, COLOR_ALREADY, 1)

    return frame


def run_gateway(camera_source, camera_id: str, api_url: str, show_preview: bool = True):
    """Main camera gateway loop."""
    cap = cv2.VideoCapture(camera_source)

    if not cap.isOpened():
        logger.error(f"Failed to open camera: {camera_source}")
        return

    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)

    logger.info(f"Camera gateway started - ID: {camera_id}, API: {api_url}")
    logger.info("Press Q or ESC in the preview window to quit.")

    frame_queue: queue.Queue = queue.Queue(maxsize=1)
    result_queue: queue.Queue = queue.Queue(maxsize=1)

    worker = threading.Thread(
        target=recognition_worker,
        args=(frame_queue, result_queue, camera_id, api_url),
        daemon=True,
    )
    worker.start()

    last_results = None

    if show_preview:
        cv2.namedWindow("AttendEase Gateway", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("AttendEase Gateway", 1280, 720)

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                logger.warning("Failed to read frame. Retrying...")
                time.sleep(0.1)
                continue

            try:
                frame_queue.put_nowait(frame)
            except queue.Full:
                pass

            try:
                last_results = result_queue.get_nowait()
            except queue.Empty:
                pass

            if show_preview:
                display_frame = draw_multi_overlay(frame.copy(), last_results)
                cv2.imshow("AttendEase Gateway", display_frame)
                cv2.resizeWindow("AttendEase Gateway", 1280, 720)

                key = cv2.waitKey(1) & 0xFF
                if key == ord("q") or key == 27:
                    logger.info("Shutting down gateway.")
                    break

    except KeyboardInterrupt:
        logger.info("Interrupted by user.")
    finally:
        frame_queue.put(None)
        worker.join(timeout=3)
        cap.release()
        if show_preview:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AttendEase Camera Gateway")
    parser.add_argument("--camera", default=0, help="Camera index or RTSP URL (default: 0)")
    parser.add_argument("--camera-id", default="main-gate", help="Camera identifier")
    parser.add_argument("--api", default="http://localhost:8000", help="Backend API URL")
    parser.add_argument("--no-preview", action="store_true", help="Run headless (no preview window)")
    args = parser.parse_args()

    camera_source = int(args.camera) if str(args.camera).isdigit() else args.camera

    run_gateway(
        camera_source=camera_source,
        camera_id=args.camera_id,
        api_url=args.api,
        show_preview=not args.no_preview,
    )
