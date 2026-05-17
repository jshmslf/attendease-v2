# AttendEase

> Gateway camera-based automatic attendance system for universities.
> Students are identified via face recognition as they enter, marked present or late, and their parents are notified via SMS.

---

## How It Works — Step by Step

1. **Admin registers a student** via the web panel (name, student ID, course, year level).
2. **Admin opens Face Enrollment** in the browser, which requests camera permission.
3. **Browser webcam activates** — admin captures 3–5 photos from different angles.
4. **Photos are saved** to the server (`backend/static/faces/{student_internal_id}/`).
5. **Face encoding is extracted** from each photo using the `face_recognition` library (HOG model).
6. **Admin clicks "Re-train Model"** — all stored photos are re-processed and encodings averaged for better accuracy.
7. **Camera scans the entrance** using one of two options:
   - **Option A (recommended):** Admin opens `/camera` in any browser — the page uses the PC's webcam directly, no Python required.
   - **Option B:** Run `camera_gateway.py` on the PC connected to the physical entrance camera.
8. A frame is sent to `POST /api/camera/recognize` every 2 seconds. The backend detects **all faces** in the frame simultaneously.
9. Each face is compared against all enrolled students using Euclidean distance on 128-D face encodings.
10. **If a match is found** (confidence ≥ 0.55), attendance is recorded as "present" or "late" based on time.
11. A mock SMS is logged: `[MOCK SMS] → +639XXXXXXX: Juan Dela Cruz has been marked present at 07:45 AM today.`
12. **Admin dashboard** receives a real-time WebSocket update per recognized student.
13. **Student logs into the portal** (`/portal`) to view their attendance history with monthly filters and attendance rate.
14. **Students can send messages** to the admin via the "Contact Admin" button in the portal. Admins read them at `/messages`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    University Entrance Gate                      │
│                                                                  │
│  Option A: Admin Browser → /camera page (getUserMedia)          │
│  Option B: camera_gateway.py (Python/OpenCV on entrance PC)     │
│                                                                  │
│  Captures frames every 2s, sends as base64 to API               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /api/camera/recognize
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python 3.11)                   │
│                                                                   │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────┐  │
│  │  Face Service    │  │  Attendance Svc   │  │  SMS Mock    │  │
│  │  (multi-face)    │→ │  (mark + notify)  │→ │  (console)   │  │
│  └──────────────────┘  └───────────────────┘  └──────────────┘  │
│             │                   │                                 │
│             ▼                   ▼                                 │
│  static/faces/{id}/     NeonTech PostgreSQL                       │
│  (local image store)    (cloud database)                          │
│             │                   │                                 │
│             └──────────┬────────┘                                 │
│                        │ WebSocket /api/camera/ws/live            │
└────────────────────────┼─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                    Next.js 14 Frontend                            │
│                                                                   │
│  Admin Panel                    Student Portal                    │
│  /dashboard  (live feed)        /portal  (own attendance)         │
│  /students   (CRUD)             /portal/login                     │
│  /enroll     (face photos)                                        │
│  /camera     (browser gate)                                       │
│  /notifications                                                   │
│  /messages   (student inbox)                                      │
└───────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI 0.115, SQLAlchemy (async), asyncpg |
| Face Recognition | `face_recognition` library (dlib HOG model), multi-face per frame |
| Database | PostgreSQL on NeonTech (cloud, serverless) |
| Frontend | Next.js 14 (App Router), Tailwind CSS, TypeScript |
| Camera — Browser | `getUserMedia` API in `/camera` admin page |
| Camera — Python | `camera_gateway.py` (OpenCV + requests) |
| Image Storage | Local filesystem (`backend/static/faces/`) |
| Timezone | Philippine Time (UTC+8) via Python `zoneinfo` |
| Notifications | Mock (logs to console — no real SMS service wired up) |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## What's New

- **Browser Live Camera** (`/camera`) — replaces `camera_gateway.py` for most setups; no Python needed at the entrance PC
- **Multi-face recognition** — detects and marks attendance for multiple students passing through simultaneously
- **Student messaging** — "Contact Admin" floating button in the portal sends a message; admin reads at `/messages`
- **Philippine Time** — all timestamps (attendance, logs, tokens) use UTC+8
- **Gateway live/offline indicator** — admin dashboard shows a real-time pulse dot indicating whether the camera is actively sending frames
- **Dev-mode clear attendance** — red "Clear (Dev)" button on the dashboard for quick testing resets
- **Individual photo deletion** — enrolled photos can be deleted one by one from the enroll page
- **Standardized date format** — "Month Day, Year" (e.g., "May 16, 2025") everywhere in the UI

---

## Project Structure

```
attendease/
├── backend/
│   ├── app/
│   │   ├── main.py                       # FastAPI entry + static file serving
│   │   ├── core/
│   │   │   ├── config.py                 # Settings (DB URL, JWT, thresholds)
│   │   │   ├── security.py               # JWT auth, password hashing, API key
│   │   │   └── timezone.py               # ph_now() → PH Time (UTC+8)
│   │   ├── db/
│   │   │   ├── session.py                # Async SQLAlchemy engine + get_db
│   │   │   └── base.py                   # Model imports for SQLAlchemy
│   │   ├── models/
│   │   │   └── models.py                 # Student, Parent, Attendance, PortalAccount, StudentMessage
│   │   ├── api/routes/
│   │   │   ├── auth.py                   # Admin + student login → JWT
│   │   │   ├── students.py               # CRUD, face enrollment, photo management
│   │   │   ├── attendance.py             # View, override, clear attendance
│   │   │   ├── camera.py                 # /recognize (multi-face) + WebSocket + /status
│   │   │   ├── notifications.py          # Parent notification log
│   │   │   └── messages.py               # Student → admin messages
│   │   └── services/
│   │       ├── face_service.py           # Encoding, multi-face recognition, image save
│   │       ├── attendance_service.py     # Mark present/late, notify parents
│   │       └── sms_service.py            # Mock SMS (prints to console)
│   ├── static/faces/                     # Local face photo storage (auto-created)
│   ├── requirements.txt
│   ├── Procfile                          # Railway deployment start command
│   ├── seed_admin.py                     # Seed default admin + demo student
│   ├── .env                              # Local config (not committed)
│   └── .env.example                      # Config template
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout
│   │   ├── page.tsx                      # Redirects → /login
│   │   ├── login/page.tsx                # Admin login
│   │   ├── (admin)/                      # Admin route group (JWT-guarded)
│   │   │   ├── layout.tsx                # Sidebar navigation
│   │   │   ├── dashboard/page.tsx        # Live attendance + WebSocket + gateway status
│   │   │   ├── students/page.tsx         # Student management + edit modal
│   │   │   ├── enroll/page.tsx           # Face enrollment via webcam, photo deletion
│   │   │   ├── camera/page.tsx           # Browser-based attendance gate (NEW)
│   │   │   ├── notifications/page.tsx    # Parent notification log
│   │   │   └── messages/page.tsx         # Student messages inbox (NEW)
│   │   └── portal/
│   │       ├── layout.tsx
│   │       ├── login/page.tsx            # Student portal login
│   │       └── page.tsx                  # Attendance view + Contact Admin CTA
│   ├── lib/api.ts                        # API client (admin helpers)
│   ├── .env.local                        # API URL (not committed)
│   └── .env.example
│
├── camera_gateway.py                     # Alternative: Python entrance camera script
├── schema.sql                            # PostgreSQL schema reference
├── schema_neon.sql                       # NeonTech-specific schema (with student_messages)
└── README.md
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 20+** and **npm** (or pnpm)
- **cmake** and C++ build tools (required to compile dlib for face recognition):
  - Ubuntu/Debian: `sudo apt install cmake build-essential libopenblas-dev`
  - macOS: `brew install cmake`
  - Windows: Install [CMake](https://cmake.org/download/) + [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++"
- **NeonTech account** with a PostgreSQL database

> **Windows tip:** `pip install face_recognition` compiles dlib from source — this takes 15–25 minutes and requires cmake + MSVC build tools. If it fails, use WSL2 (Ubuntu) instead.

---

## Local Development Setup

### 1. Database Schema

Run the schema against your NeonTech database. Either:

```bash
psql "postgresql://user:pass@host/db?sslmode=require" -f schema_neon.sql
```

Or paste `schema_neon.sql` contents into the **NeonTech SQL Editor** tab.

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # macOS / Linux

# Install dependencies (dlib compilation takes 15–25 min first time)
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Open .env and set DATABASE_URL to your NeonTech connection string

# Seed default admin and demo student accounts
python seed_admin.py

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000`  
Swagger docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment (defaults point to localhost:8000 — usually no change needed)
cp .env.example .env.local

# Start dev server
npm run dev
```

Frontend at `http://localhost:3000`

### 4. Camera (choose one)

**Option A — Browser (recommended, no extra install):**

1. Log in as admin at `http://localhost:3000/login`
2. Click **Live Camera** in the sidebar
3. Click **Start Camera** — browser asks for camera permission
4. Attendance is marked automatically every 2 seconds

**Option B — Python gateway (for a dedicated entrance PC with a physical camera):**

```bash
# Install (if not already done)
pip install opencv-python requests

# Run — camera 0 = built-in webcam, 1 = first USB camera
python camera_gateway.py --camera 0 --api http://localhost:8000

# Headless mode (no preview window)
python camera_gateway.py --camera 0 --api http://localhost:8000 --no-preview
```

Gateway keyboard shortcuts (preview window):

| Key | Action |
|-----|--------|
| `Q` or `ESC` | Quit gracefully |
| `Ctrl+C` | Force quit (terminal / headless) |

---

## First Login Credentials

After running `seed_admin.py`:

| Role | URL | Username | Password |
|------|-----|----------|----------|
| Admin | `/login` | `admin` | `admin123` |
| Student Portal | `/portal/login` | `student` | `student123` |

> Change these credentials before any public demo.

---

## Face Enrollment Guide

1. Log in as admin → click **Face Enrollment** in the sidebar
2. Search for a student and select them from the left panel
3. Click **Start Camera** — browser asks for permission
4. Click **Capture Photo** 3–5 times from slightly different angles (face centered in the oval guide)
5. Click **Enroll All Photos** to upload and extract face encodings
6. Click **Re-train Model** to average all enrolled photos for improved accuracy
7. To remove a bad photo, click the **✕** button on any enrolled photo thumbnail
8. Repeat for each student, then use the **Live Camera** or Python gateway to test recognition

---

## Deployment

### Backend → Railway

Railway auto-detects Python via `requirements.txt` and starts the server using `Procfile`.

> **Note:** dlib (face recognition) compiles from source on first build — Railway's build may take 20–30 minutes the first time.

1. Push your repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select your repo, set **Root Directory** to `backend/`
4. Railway detects Python and runs: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. In the Railway dashboard → **Variables**, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your NeonTech connection string |
| `SECRET_KEY` | Any random string of 32+ characters |
| `CAMERA_API_KEY` | `attendease-camera-secret-key` |
| `LOCAL_STORAGE_PATH` | `static/faces` |
| `FACE_MATCH_THRESHOLD` | `0.55` |
| `LATE_THRESHOLD_HOUR` | `8` |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` (add after Vercel deploy) |

6. **(Optional but recommended)** Add a **Volume** in the Railway dashboard mounted at `/app/static` so enrolled face photos persist across redeploys. Without this, photos are lost on each deploy (face encodings in the DB are kept, but re-enrollment will be needed).
7. Copy your Railway public URL (e.g. `https://attendease-backend.up.railway.app`)

---

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo
2. Set **Root Directory** to `frontend/`
3. Under **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.up.railway.app` |

4. Click **Deploy** — Vercel builds Next.js automatically

> **HTTPS note:** The browser camera page (`/camera`) uses `getUserMedia`, which requires HTTPS. Vercel provides HTTPS automatically. For local dev, `localhost` is exempt from this requirement.

5. After Vercel gives you a URL (e.g. `https://attendease.vercel.app`), go back to Railway and update `ALLOWED_ORIGINS` to that URL.

---

## API Endpoints Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/admin/login` | None | Admin login → JWT |
| POST | `/api/auth/student/login` | None | Student portal login → JWT |

### Students
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/students/` | Admin | List all active students |
| POST | `/api/students/` | Admin | Register new student |
| GET | `/api/students/{id}` | Admin | Get student detail |
| PUT | `/api/students/{id}` | Admin | Update student info |
| POST | `/api/students/train` | Admin | Re-train all face encodings from stored photos |
| POST | `/api/students/{id}/enroll-face` | Admin | Upload face photo (multipart/form-data) |
| GET | `/api/students/{id}/photos` | Admin | List enrolled face photos |
| DELETE | `/api/students/{id}/photos/{filename}` | Admin | Delete a specific enrolled photo |
| GET | `/api/students/{id}/parents` | Admin | List parent contacts |
| POST | `/api/students/{id}/parents` | Admin | Add parent contact |
| PUT | `/api/students/{id}/parents/{parent_id}` | Admin | Update parent contact |
| GET | `/api/students/{id}/portal-account` | Admin | Check if portal account exists |
| POST | `/api/students/{id}/portal-account` | Admin | Create student portal login |
| PUT | `/api/students/{id}/portal-account` | Admin | Reset portal account password |
| GET | `/api/students/me` | Student | Get own profile |
| PUT | `/api/students/me` | Student | Update own profile |
| GET | `/api/students/me/parents` | Student | Get own parent contacts |

### Attendance
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/attendance/today` | Admin | Today's attendance records |
| POST | `/api/attendance/override` | Admin | Manual attendance correction |
| DELETE | `/api/attendance/` | Admin | Clear attendance (dev — all or by date) |
| GET | `/api/attendance/student/me` | Student | Own attendance records (filterable by month/year) |

### Camera
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/camera/recognize` | Camera Key | Submit frame → multi-face recognition → list of results |
| GET | `/api/camera/status` | Admin | Gateway live/offline status + seconds since last frame |
| WS | `/api/camera/ws/live` | None | Real-time attendance WebSocket feed |

### Notifications & Messages
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications/` | Admin | Parent notification log |
| POST | `/api/messages/` | Student | Send support message to admin |
| GET | `/api/messages/` | Admin | List all student messages |
| PUT | `/api/messages/{id}/read` | Admin | Mark message as read |

### Static
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/static/faces/{student_id}/{filename}` | None | Serve enrolled face photos |
| GET | `/health` | None | Health check |

---

## Face Recognition Notes

- **Model:** HOG (Histogram of Oriented Gradients) — fast, CPU-friendly, no GPU required. Suitable for controlled gate/hallway settings with decent lighting.
- **Encoding:** 128-dimensional face descriptor vector, stored as JSON string in PostgreSQL.
- **Threshold:** 0.55 confidence (1 − Euclidean distance). Configurable via `FACE_MATCH_THRESHOLD`. Lower = stricter.
- **Multi-face:** All faces detected in a single frame are recognized and attendance-marked simultaneously.
- **Multi-photo averaging:** Enrolling 3–5 photos per student and clicking "Re-train Model" averages the encodings, significantly reducing false negatives.
- **Late threshold:** Configurable via `LATE_THRESHOLD_HOUR` (default: 8 AM). Records after this hour are marked `late`.
- **Duplicate prevention:** One attendance record per student per calendar day (PH time).
- **Confidence logging:** Every recognition attempt stores the confidence score for analysis.
- **Manual override:** Admin can correct any record with notes (`is_manual_override = true`).

---

## Known Limitations

- **Mock SMS:** Parent notifications are printed to the server console only — no real SMS is sent. Integrate with Twilio, Semaphore, or any SMS API by replacing `sms_service.py`.
- **Frame-based scanning:** The camera captures still frames every 2 seconds rather than a live video stream. This is sufficient for an entrance gate with moderate throughput.
- **Local face photo storage:** Photos are stored on the server's filesystem. On Railway without a persistent volume, they reset on each redeploy (encodings in the database are preserved). Add a Railway Volume at `/app/static` to avoid this.
- **dlib compilation:** Installing `face_recognition` requires compiling dlib from source — takes 15–25 minutes and needs cmake + C++ build tools. On Windows, WSL2 (Ubuntu) is the easiest path.
- **HTTPS for browser camera:** `getUserMedia` (used by `/camera` and `/enroll`) requires HTTPS in production. Vercel handles this automatically; for custom servers ensure SSL termination.
- **Single server:** No horizontal scaling. Suitable for a thesis demo or small deployment.
