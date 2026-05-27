# AttendEase - User Manual

> Camera-based automatic attendance system for university entrance gates.
> Students are recognized by face as they walk in, marked present or late, and the admin sees it in real time.

---

## Table of Contents

1. [Using the Live Website](#1-using-the-live-website)
   - [Admin Panel](#admin-panel)
   - [Student Portal](#student-portal)
2. [Running on Your Own Machine](#2-running-on-your-own-machine)
   - [Prerequisites](#prerequisites)
   - [Step-by-step Setup](#step-by-step-setup)
3. [Face Enrollment Walkthrough](#3-face-enrollment-walkthrough)
4. [Tips & Troubleshooting](#4-tips--troubleshooting)

---

## 1. Using the Live Website

> Replace the placeholder URLs below with the actual deployed links once available.

| Who | URL |
|-----|-----|
| Admin Panel | `https://your-app.vercel.app` |
| Student Portal | `https://your-app.vercel.app/portal/login` |

---

### Admin Panel

#### Logging In

1. Open `https://your-app.vercel.app` in your browser.
2. Enter your **username** and **password** on the login screen.
3. Click **Sign In** - you will land on the Dashboard.

---

#### Dashboard

The Dashboard is your main overview screen. It shows:

- **Today's attendance stats** - how many students are present, late, or absent so far.
- **Live feed** - every time a student is recognized at the gate, a card appears here in real time (no page refresh needed).
- Today's date is shown in the top right corner.

---

#### Students

Go to **Students** in the left sidebar.

**Adding a student:**
1. Click **+ Add Student** (top right).
2. Fill in the form: Student ID, First Name, Last Name, Email, Course, Year Level.
3. Click **Add Student**. The student appears in the table.

**Editing a student:**
1. Click **Edit** on any row.
2. A panel opens with three tabs:
   - **Student Info** - update name, email, course, year.
   - **Parent / Guardian** - add or remove the student's emergency contacts (used for SMS notifications).
   - **Credentials** - create or reset the student's portal login password.
3. Make your changes and click the save button in each tab.

**Deleting a student:**
1. Click **Delete** on any row.
2. A confirmation popup appears showing the student's name and ID.
3. Click **Delete** to confirm, or **Cancel** to go back.

> Warning: Deleting a student removes all their attendance records permanently.

---

#### Face Enrollment

This is where you register a student's face so the camera can recognize them.

1. Go to **Face Enrollment** in the sidebar.
2. Search for the student in the left list and click their name.
3. Click **Start Camera** - allow camera access if the browser asks.
4. Position the student's face in the frame (good lighting, looking straight at the camera).
5. Click **Capture** - do this **3 to 5 times** from slightly different angles (slight left, slight right, straight).
6. Click **Enroll Photos**. The photos are saved to the server.
7. After enrolling one or more students, click **Re-train Model** (top right). This reprocesses all photos and improves accuracy.

> The face badge on the Students page will show **Enrolled** in green after a successful enrollment.

---

#### Live Camera

This page turns the admin's browser into the entrance gate camera. No extra hardware or software needed.

1. Go to **Live Camera** in the sidebar.
2. Optionally change the **Camera ID** field (useful if you have multiple gates).
3. Click **Start Camera** - allow camera access.
4. Point the camera at the entrance. Every 2 seconds, a frame is sent to the server.
5. When a student is recognized:
   - A **green box** appears around their face with their name and status (Present/Late).
   - A **cyan box** means they were already marked today.
   - A **red box** means the face is unrecognized.
6. The bottom bar shows the last recognized student.
7. Click **Stop** when done, or use the fullscreen button (top-right of the video) for a cleaner view.

---

#### Notifications

Shows the full attendance log - every recognition event with student name, time, date, and status. Use this to review past records.

---

#### Messages

Students can send messages to the admin from the student portal. This page shows all received messages. Unread messages are highlighted.

Click **Mark as Read** on any message to clear the highlight.

---

### Student Portal

#### Logging In

1. Open `https://your-app.vercel.app/portal/login`.
2. Enter your **Student ID** (e.g., `2024-00001`) and **Password** (given by your admin).
3. Click **Sign In**.

---

#### Viewing Attendance

After logging in, you will see:

- **Your profile** - name, student ID, course, year level, email.
- **Parent / Guardian contacts** (if added by admin).
- **Attendance Rate** - percentage for the selected period, with a color-coded bar.
- **Breakdown** - total Present, Late, and Absent counts.
- **Attendance Records** - a list of every recorded day with the date and time-in.

Use the **Month** and **Year** dropdowns to filter records. Click **Refresh** to reload.

---

#### Contacting Admin

Click the **Contact Admin** button (floating, bottom-right corner).

1. Type your message or concern in the text box.
2. Click **Send**.
3. A success confirmation appears. The admin will see your message in their Messages page.

---

## 2. Running on Your Own Machine

Follow these steps to run AttendEase locally for development or testing.

### Prerequisites

Make sure you have these installed before starting:

| Tool | Version | Download |
|------|---------|---------|
| Git | Any | https://git-scm.com |
| Python | 3.11 or higher | https://python.org |
| Node.js | 18 or higher | https://nodejs.org |
| pnpm | Latest | Run: `npm install -g pnpm` |

You also need a free **NeonTech PostgreSQL** database:
1. Go to https://neon.tech and create a free account.
2. Create a new project - copy the **Connection String** (it looks like `postgresql://user:pass@host/dbname?sslmode=require`).

---

### Step-by-step Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/your-username/attendease.git
cd attendease
```

---

#### 2. Set Up the Backend

Open a terminal in the `backend/` folder:

```bash
cd backend
```

**Create and activate a virtual environment:**

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac / Linux
python -m venv venv
source venv/bin/activate
```

**Install dependencies:**

```bash
pip install -r requirements.txt
```

> Note: `face-recognition` installs `dlib` which may take a few minutes to compile on some machines.

**Create your environment file:**

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Open `.env` in any text editor and fill in the values:

```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require   # from NeonTech
SECRET_KEY=paste-a-random-secret-here
ALLOWED_ORIGINS=["http://localhost:3000"]
FACE_MATCH_THRESHOLD=0.6
LOCAL_STORAGE_PATH=static/faces
LATE_THRESHOLD_HOUR=8
DEBUG=False
```

To generate a secure `SECRET_KEY`, run:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**Run database migrations:**

```bash
alembic upgrade head
```

**Seed the database** (creates default admin + demo student):

```bash
python seed_admin.py
```

After seeding, you will see:

```
Admin login:  admin / admin123
Student portal login:  2024-00001 / student123
```

> Change these passwords after your first login.

**Start the backend server:**

```bash
uvicorn app.main:app --reload
```

The API is now running at **http://localhost:8000**

---

#### 3. Set Up the Frontend

Open a **second terminal** in the `frontend/` folder:

```bash
cd frontend
```

**Create your environment file:**

```bash
# Windows
copy .env.example .env.local

# Mac / Linux
cp .env.example .env.local
```

The default values in `.env.local` already point to `localhost:8000` - no changes needed for local dev.

**Install dependencies:**

```bash
pnpm install
```

**Start the frontend:**

```bash
pnpm dev
```

The app is now running at **http://localhost:3000**

---

#### 4. Open the App

- **Admin Panel:** http://localhost:3000 → log in with `admin` / `admin123`
- **Student Portal:** http://localhost:3000/portal/login → log in with `2024-00001` / `student123`

---

## 3. Face Enrollment Walkthrough

This applies to both the deployed version and local. Follow this exact order every time you register a new student:

**Step 1 - Add the student**
- Go to **Students** → click **+ Add Student** → fill in the form → save.

**Step 2 - Enroll their face**
- Go to **Face Enrollment** → search and select the student.
- Click **Start Camera** and allow camera access.
- Have the student sit in front of the camera with good lighting (face the light source, not away from it).
- Click **Capture** 3–5 times, slightly tilting their head between captures.
- Click **Enroll Photos**.

**Step 3 - Re-train the model**
- Click **Re-train Model** (top right of Face Enrollment page).
- Wait for the confirmation message. This step is required after enrolling any new student.

**Step 4 - Test it**
- Go to **Live Camera** → Start Camera.
- Have the student walk past the camera.
- A green box with their name should appear within 2 seconds.

---

## 4. Tips & Troubleshooting

**Camera not working in the browser**
- Check that you allowed camera access when the browser asked.
- Try a different browser (Chrome or Edge recommended).
- If using HTTPS on the deployed version, camera access only works on secure origins - this is handled automatically by Vercel.

**Face not being recognized**
- The student may not have been enrolled yet - go to Face Enrollment.
- Re-enroll with better lighting (avoid backlighting or shadows across the face).
- Capture more photos (5 is better than 3).
- Click **Re-train Model** again after re-enrolling.
- If recognition is too strict or too loose, ask your admin to adjust `FACE_MATCH_THRESHOLD` in `.env` (lower = stricter, higher = more lenient; default is `0.6`).

**Student arriving on time marked as Late**
- The late cutoff defaults to **8:00 AM**. Change `LATE_THRESHOLD_HOUR` in `.env` (e.g., `7` for 7:00 AM).
- Restart the backend after changing `.env`.

**Student forgot their portal password**
- Admin goes to **Students** → click **Edit** on that student → **Credentials** tab → enter a new password → save.

**"Already marked today" (cyan box on camera)**
- This is normal. Once a student is marked for the day, subsequent recognitions show cyan instead of green to avoid duplicates.

**Backend won't start - missing packages**
- Make sure your virtual environment is activated (`venv\Scripts\activate` on Windows).
- Run `pip install -r requirements.txt` again.

**`alembic upgrade head` fails**
- Double-check that `DATABASE_URL` in `.env` is correct and includes `?sslmode=require` for NeonTech.
- Make sure you are inside the `backend/` folder when running the command.
