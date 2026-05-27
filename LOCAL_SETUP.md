# AttendEase - Local Setup Guide (Windows)

> Step-by-step guide to run AttendEase on your own Windows machine after cloning from GitHub.
> No Docker, no cmake, no Visual Studio Build Tools required.

---

## Step 1 - Install Required Software

Install these in order. Do not skip any.

### 1. Git
Download and install from: https://git-scm.com/download/win

Use all default settings during installation.

---

### 2. Python 3.11.9 (exact version - do not use 3.12, 3.13, or 3.14)

> Why 3.11 specifically? The face recognition library uses `dlib-bin`, which only has a pre-built Windows binary for Python 3.11. Any other version will fail.

Download from: https://www.python.org/downloads/release/python-3119/

Scroll down to **Files** and download:
- **Windows installer (64-bit)** → `python-3.11.9-amd64.exe`

During installation:
- **Check "Add Python 3.11 to PATH"** ← very important, do not skip this
- Click "Install Now"

Verify after install - open Command Prompt and run:
```
python --version
```
It should print: `Python 3.11.9`

---

### 3. Node.js (LTS version)

Download from: https://nodejs.org

Click the **LTS** button (left side). Install with all default settings.

Verify after install:
```
node --version
```
Should print `v18.x.x` or higher.

---

### 4. pnpm

After Node.js is installed, open Command Prompt and run:
```
npm install -g pnpm
```

Verify:
```
pnpm --version
```

---

## Step 2 - Get a Free Database

AttendEase uses PostgreSQL hosted on NeonTech (free, no credit card needed).

1. Go to https://neon.tech and create a free account.
2. Create a new **Project** (any name).
3. On the project dashboard, find **Connection String** - it looks like:
   ```
   postgresql://user:password@host/dbname?sslmode=require
   ```
4. Copy it - you will need it in Step 4.

---

## Step 3 - Clone the Repository

Open **Command Prompt** (search "cmd" in Start menu) and run:

```
git clone https://github.com/jshmslf/attendease-v2.git
cd attendease-v2
```

---

## Step 4 - Set Up the Backend

All commands below must be run in **Command Prompt** (not PowerShell).

```
cd backend
```

**Create a virtual environment:**
```
python -m venv venv
```

**Activate it:**
```
venv\Scripts\activate
```

You should see `(venv)` appear at the start of your prompt. If you don't see it, the venv is not active - do not continue until it shows.

**Double-check you are on Python 3.11:**
```
python --version
```
Must print `Python 3.11.x`. If it says anything else, stop and reinstall Python 3.11.9.

---

**Install face recognition dependencies (in this exact order):**

```
pip install dlib-bin==19.24.6
```
```
pip install face-recognition==1.3.0 --no-deps
```
```
pip install face-recognition-models Pillow scipy
```

> Why this order? `dlib-bin` is a pre-built binary that provides the face recognition engine without any compilation. Installing `face-recognition` with `--no-deps` prevents pip from downloading and trying to compile the original `dlib` from source (which would require cmake and Visual Studio and take 30+ minutes).

**Install the rest of the backend packages:**
```
pip install -r requirements.txt
```

---

**Create the environment file:**
```
copy .env.example .env
```

Open the `.env` file in Notepad (or any text editor) and fill in your values:

```
DATABASE_URL=paste-your-neontech-connection-string-here
SECRET_KEY=paste-a-random-secret-key-here
ALLOWED_ORIGINS=["http://localhost:3000"]
FACE_MATCH_THRESHOLD=0.6
LOCAL_STORAGE_PATH=static/faces
LATE_THRESHOLD_HOUR=8
DEBUG=False
```

To generate a SECRET_KEY, run this command (with venv active):
```
python -c "import secrets; print(secrets.token_hex(32))"
```
Copy the output and paste it as the value for `SECRET_KEY`.

---

**Create the database tables:**
```
alembic upgrade head
```

**Create the default admin and demo student accounts:**
```
python seed_admin.py
```

You should see:
```
Admin login:  admin / admin123
Student portal login:  student / student123
```

**Start the backend server:**
```
uvicorn app.main:app --reload
```

Leave this Command Prompt window open. The backend is now running at `http://localhost:8000`.

---

## Step 5 - Set Up the Frontend

Open a **second Command Prompt** window (keep the backend running in the first one).

Navigate to the frontend folder from the repo root:
```
cd attendease-v2\frontend
```

**Create the environment file:**
```
copy .env.example .env.local
```

No changes needed - the default values already point to `localhost:8000`.

**Install frontend dependencies:**
```
pnpm install
```

**Start the frontend:**
```
pnpm dev
```

The frontend is now running at `http://localhost:3000`.

---

## Step 6 - Open the App

Open your browser and go to:

| What | URL | Username / ID | Password |
|------|-----|---------------|----------|
| Admin Panel | http://localhost:3000 | `admin` | `admin123` |
| Student Portal | http://localhost:3000/portal/login | `2024-00001` | `student123` |

> Change these default passwords after your first login.

---

## Every Time You Want to Run It Again

You do not need to reinstall anything. Just:

**Terminal 1 - Backend:**
```
cd attendease-v2\backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```
cd attendease-v2\frontend
pnpm dev
```

---

## Common Errors

**"python is not recognized as an internal or external command"**
→ Python was not added to PATH during installation. Uninstall Python and reinstall it, making sure to check "Add Python 3.11 to PATH" on the first screen.

**"venv\Scripts\activate" is not recognized**
→ Make sure you are in Command Prompt (cmd), not PowerShell. In PowerShell, use `.\venv\Scripts\activate` instead.

**"(venv) disappears after opening a new terminal"**
→ The virtual environment must be activated every time you open a new terminal. Run `venv\Scripts\activate` again.

**"alembic: command not found" or "uvicorn: command not found"**
→ The virtual environment is not active. Run `venv\Scripts\activate` first.

**Error about dlib / face_recognition during install**
→ You are likely using the wrong Python version. Run `python --version` - it must be `3.11.x`. If it says 3.12 or higher, you need to install Python 3.11.9 and create the venv again.

**"Could not connect to database" or alembic errors**
→ Your `DATABASE_URL` in `.env` is incorrect. Go back to NeonTech and copy the connection string again. Make sure it ends with `?sslmode=require`.

**Frontend shows blank page or API errors**
→ Make sure the backend is running in the other terminal window. Check `http://localhost:8000/health` - it should return `{"status": "ok"}`.
