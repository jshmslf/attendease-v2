# AttendEase

> Browser-based automatic attendance system for university entrance gates.
> Students are recognized by face as they walk in, marked present or late, and the admin sees it in real time - no extra hardware or software needed at the gate.

---

## How It Works

1. **Admin registers a student** - name, student ID, course, year level.
2. **Admin enrolls the student's face** - the browser webcam captures 3–5 photos from different angles.
3. **Photos are uploaded** to the server and face encodings are extracted using the `face_recognition` library.
4. **Admin clicks "Re-train Model"** - all stored photos are re-processed for better accuracy.
5. **Admin opens the Live Camera page** (`/camera`) on the entrance PC - the browser requests camera access.
6. **A frame is sent to the server every 2 seconds.** All faces in the frame are detected simultaneously.
7. **Each face is matched** against enrolled students. Matches above the confidence threshold are recorded.
8. Attendance is saved as **present** or **late** based on arrival time (default cutoff: 8:00 AM).
9. A mock SMS is logged to the server console: `[MOCK SMS] → Juan Dela Cruz has been marked present at 07:45 AM.`
10. **Admin dashboard** receives a real-time update via WebSocket - no page refresh needed.
11. **Students log into the portal** (`/portal`) to view their attendance history and rate.
12. **Students can contact admin** directly from the portal via the "Contact Admin" button.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  University Entrance Gate                    │
│                                                             │
│   Admin opens /camera in any browser on the gate PC        │
│   Browser captures a frame every 2 seconds (getUserMedia)  │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /api/camera/recognize
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               FastAPI Backend (Python 3.11)                 │
│                                                             │
│  Face Service       Attendance Service     SMS Mock         │
│  (multi-face)  →   (mark + notify)    →   (console log)    │
│       │                   │                                 │
│       ▼                   ▼                                 │
│  static/faces/      NeonTech PostgreSQL                     │
│  (face photos)      (cloud database)                        │
│                           │                                 │
│              WebSocket /api/camera/ws/live                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Next.js 14 Frontend                        │
│                                                             │
│  Admin Panel                   Student Portal               │
│  /dashboard   (live feed)      /portal        (attendance)  │
│  /students    (manage)         /portal/login               │
│  /enroll      (face photos)                                 │
│  /camera      (entrance gate)                               │
│  /notifications                                             │
│  /messages    (student inbox)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI 0.115, SQLAlchemy (async), asyncpg |
| Face Recognition | `face_recognition` library (dlib HOG), multi-face per frame |
| Database | PostgreSQL on NeonTech (cloud, serverless) |
| Frontend | Next.js 14 (App Router), Tailwind CSS, TypeScript |
| Camera | Browser `getUserMedia` API - no Python or OpenCV at the gate |
| Image Storage | Local filesystem (`backend/static/faces/`) |
| Realtime | WebSocket (`/api/camera/ws/live`) |
| Timezone | Philippine Time (UTC+8) via `zoneinfo` |
| Notifications | Mock SMS (console log - swap `sms_service.py` for real provider) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Project Structure

```
attendease/
├── backend/
│   ├── app/
│   │   ├── main.py                        # FastAPI entry + static file serving
│   │   ├── core/
│   │   │   ├── config.py                  # Settings (DB URL, JWT, thresholds)
│   │   │   ├── security.py                # JWT auth, password hashing, API key
│   │   │   └── timezone.py                # ph_now() → PH Time (UTC+8)
│   │   ├── db/
│   │   │   ├── session.py                 # Async SQLAlchemy engine + get_db
│   │   │   └── base.py                    # Model imports for Alembic
│   │   ├── models/
│   │   │   └── models.py                  # Student, Parent, Attendance, PortalAccount, StudentMessage
│   │   ├── api/routes/
│   │   │   ├── auth.py                    # Admin + student login → JWT
│   │   │   ├── students.py                # CRUD, face enrollment, photo management
│   │   │   ├── attendance.py              # View, override, clear attendance
│   │   │   ├── camera.py                  # /recognize (multi-face) + WebSocket + /status
│   │   │   ├── notifications.py           # Parent notification log
│   │   │   └── messages.py                # Student → admin messages
│   │   └── services/
│   │       ├── face_service.py            # Encoding, multi-face recognition, image save
│   │       ├── attendance_service.py      # Mark present/late, notify parents
│   │       └── sms_service.py             # Mock SMS (prints to console)
│   ├── static/faces/                      # Enrolled face photos (auto-created)
│   ├── requirements.txt
│   ├── Procfile                           # Render start command
│   ├── seed_admin.py                      # Seed default admin + demo student
│   ├── .env.example                       # Config template
│   └── .env                              # Local config (git-ignored)
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                     # Root layout + favicon
│   │   ├── page.tsx                       # Redirect → /login
│   │   ├── login/page.tsx                 # Admin login
│   │   ├── (admin)/
│   │   │   ├── layout.tsx                 # Sidebar navigation
│   │   │   ├── dashboard/page.tsx         # Live feed + WebSocket + stats
│   │   │   ├── students/page.tsx          # Student management + edit modal
│   │   │   ├── enroll/page.tsx            # Face enrollment via webcam
│   │   │   ├── camera/page.tsx            # Browser entrance gate camera
│   │   │   ├── notifications/page.tsx     # Attendance notification log
│   │   │   └── messages/page.tsx          # Student messages inbox
│   │   └── portal/
│   │       ├── login/page.tsx             # Student portal login
│   │       └── page.tsx                   # Attendance view + Contact Admin
│   ├── lib/api.ts                         # Admin API client
│   ├── public/logo/                       # App logo files
│   ├── .env.example                       # Config template
│   └── .env.local                        # Local config (git-ignored)
│
├── .gitignore
├── runtime.txt                            # Forces Python 3.11.9 on Render
├── USER_MANUAL.md                         # End-user guide (admin + student)
└── README.md
```

---

## Local Development Setup

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** and **pnpm** (`npm install -g pnpm`)
- **cmake + C++ build tools** - required to compile dlib:
  - Ubuntu/Debian: `sudo apt install cmake build-essential libopenblas-dev`
  - macOS: `brew install cmake`
  - Windows: [CMake](https://cmake.org/download/) + [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (select "Desktop development with C++")
- **NeonTech account** - free PostgreSQL database at https://neon.tech

> **Windows tip:** Compiling dlib takes 15–25 minutes and needs MSVC build tools. If it keeps failing, use WSL2 (Ubuntu) instead.

---

### 1. Clone

```bash
git clone https://github.com/your-username/attendease.git
cd attendease
```

---

### 2. Backend

```bash
cd backend

python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac / Linux

pip install -r requirements.txt

cp .env.example .env         # Windows: copy .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
SECRET_KEY=run: python -c "import secrets; print(secrets.token_hex(32))"
ALLOWED_ORIGINS=["http://localhost:3000"]
FACE_MATCH_THRESHOLD=0.6
LOCAL_STORAGE_PATH=static/faces
LATE_THRESHOLD_HOUR=8
DEBUG=False
```

```bash
alembic upgrade head     # create all tables
python seed_admin.py     # create default admin + demo student
uvicorn app.main:app --reload
```

API running at **http://localhost:8000** · Swagger docs at **http://localhost:8000/docs**

---

### 3. Frontend

```bash
cd frontend

cp .env.example .env.local   # Windows: copy .env.example .env.local
# No changes needed - defaults point to localhost:8000

pnpm install
pnpm dev
```

App running at **http://localhost:3000**

---

### 4. Default Credentials

After running `seed_admin.py`:

| Role | Login page | Username / Student ID | Password |
|------|-----------|----------------------|----------|
| Admin | `/login` | `admin` | `admin123` |
| Student | `/portal/login` | `2024-00001` | `student123` |

> Change these before any public demo.

---

## Deployment

### Backend → Render

Render auto-detects Python via `requirements.txt` and starts the server using `Procfile`.

> First build may take 20–30 minutes - dlib compiles from source.

> **Important:** The repo includes a `runtime.txt` at the root with `python-3.11.9`. This forces Render to use Python 3.11 instead of its default (3.14), which has no pre-built `dlib` wheels and causes the build to hang indefinitely.

1. Push your repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Web Service**.
3. Connect your GitHub repo and select it.
4. Set these in the Render dashboard:

| Setting | Value |
|---------|-------|
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

5. Under **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | NeonTech connection string |
| `SECRET_KEY` | Random 32+ char string |
| `CAMERA_API_KEY` | `attendease-camera-secret-key` |
| `LOCAL_STORAGE_PATH` | `static/faces` |
| `FACE_MATCH_THRESHOLD` | `0.55` |
| `LATE_THRESHOLD_HOUR` | `8` |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |

6. Optionally add a **Disk** (under **Advanced**) mounted at `/app/static` so enrolled face photos survive redeploys.
7. Click **Deploy**. Copy the Render public URL (e.g. `https://attendease.onrender.com`) - you'll need it for Vercel.

> **Free tier note:** Render free web services spin down after 15 minutes of inactivity. The first request after idle takes ~30 seconds to wake up.

---

### Frontend → Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import your repo.
2. Set **Root Directory** to `frontend`.
3. Add environment variable:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.onrender.com` |

4. Deploy. Vercel provides HTTPS automatically (required for `getUserMedia`).
5. Go back to Render and update `ALLOWED_ORIGINS` to your Vercel URL.

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/admin/login` | Admin login → JWT |
| POST | `/api/auth/student/login` | Student portal login → JWT |

### Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students/` | List all students |
| POST | `/api/students/` | Register new student |
| GET | `/api/students/{id}` | Get student detail |
| PUT | `/api/students/{id}` | Update student |
| DELETE | `/api/students/{id}` | Delete student |
| POST | `/api/students/train` | Re-train all face encodings |
| POST | `/api/students/{id}/enroll-face` | Upload face photo |
| GET | `/api/students/{id}/photos` | List enrolled photos |
| DELETE | `/api/students/{id}/photos/{filename}` | Delete a photo |
| GET | `/api/students/{id}/parents` | List parent contacts |
| POST | `/api/students/{id}/parents` | Add parent contact |
| PUT | `/api/students/{id}/parents/{parent_id}` | Update parent contact |
| DELETE | `/api/students/{id}/parents/{parent_id}` | Delete parent contact |
| GET | `/api/students/{id}/portal-account` | Check portal account |
| POST | `/api/students/{id}/portal-account` | Create portal login |
| PUT | `/api/students/{id}/portal-account` | Reset portal password |
| GET | `/api/students/me` | Student: own profile |
| PUT | `/api/students/me` | Student: update own profile |
| GET | `/api/students/me/parents` | Student: own parent contacts |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance/today` | Today's records |
| POST | `/api/attendance/override` | Manual correction |
| DELETE | `/api/attendance/` | Clear records (dev) |
| GET | `/api/attendance/student/me` | Student: own records |

### Camera
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/camera/recognize` | Submit frame → attendance results |
| GET | `/api/camera/status` | Gateway live/offline status |
| WS | `/api/camera/ws/live` | Real-time attendance WebSocket |

### Notifications & Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/` | Parent notification log |
| POST | `/api/messages/` | Student: send message to admin |
| GET | `/api/messages/` | Admin: list all messages |
| PUT | `/api/messages/{id}/read` | Admin: mark message as read |

---

## Face Recognition Notes

- **Model:** HOG (fast, CPU-only, no GPU needed) - suitable for gate/hallway with decent lighting.
- **Encoding:** 128-D face descriptor stored in PostgreSQL.
- **Multi-face:** All faces in a frame are processed in one pass.
- **Threshold:** `FACE_MATCH_THRESHOLD=0.6` - lower = stricter, higher = more lenient.
- **Accuracy tip:** Enroll 3–5 photos per student at different angles and always click **Re-train Model** after enrolling.
- **Duplicate prevention:** One record per student per calendar day (PH time).

---

## Known Limitations

- **Mock SMS** - notifications are logged to the server console only. Replace `sms_service.py` with Twilio, Semaphore, or any SMS API for real messages.
- **Local face photo storage** - photos live on the server filesystem. Add a Render Volume at `/app/static` to persist them across redeploys.
- **Frame-based scanning** - one frame every 2 seconds, not a continuous video stream. Sufficient for a single-lane entrance gate.
- **dlib compilation** - first install takes 15–25 minutes and needs cmake + C++ build tools.
- **Single server** - no horizontal scaling. Designed for thesis demo or small deployment.
