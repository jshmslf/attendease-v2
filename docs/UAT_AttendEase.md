# User Acceptance Testing (UAT)
## AttendEase — Gateway Camera Attendance System
### AMA Computer College Pangasinan Campus

---

**System Version:** 1.0
**Test Date:** ___________________________
**Tester Name:** ___________________________
**Tester Role:** ___________________________  *(e.g. Faculty, Admin Staff, Student)*
**Environment:** ___________________________  *(e.g. School LAN, Deployed URL)*

---

## Instructions for Evaluators

1. Access the running system using the URL provided by the developer.
2. Perform each test scenario step by step.
3. Record the **Actual Result** in your own words.
4. Mark **Pass** or **Fail** in the result column.
5. Add any comments or suggestions in the **Remarks** column.
6. Sign at the bottom after completing all modules.

---

## Module 1 — Authentication

| # | Scenario | Steps | Expected Result | Actual Result | Pass / Fail | Remarks |
|---|---|---|---|---|---|---|
| 1.1 | Admin login with correct credentials | 1. Go to `/login` 2. Enter valid username and password 3. Click **Login** | Redirected to Admin Dashboard; no error shown | | | |
| 1.2 | Admin login with wrong password | 1. Go to `/login` 2. Enter valid username, wrong password 3. Click **Login** | Error message: *"Incorrect username or password. Please try again."* | | | |
| 1.3 | Student portal login with correct Student ID | 1. Go to `/portal/login` 2. Enter valid Student ID (e.g. 2024-00001) and password 3. Click **Login** | Redirected to student portal with attendance data | | | |
| 1.4 | Student portal login with wrong ID format | 1. Go to `/portal/login` 2. Enter an ID that does not exist 3. Click **Login** | Error message shows correct ID format hint | | | |

---

## Module 2 — Student Management

| # | Scenario | Steps | Expected Result | Actual Result | Pass / Fail | Remarks |
|---|---|---|---|---|---|---|
| 2.1 | Add a new student | 1. Go to **Students** page 2. Click **Add Student** 3. Fill in all required fields 4. Click **Save** | New student appears in the student list | | | |
| 2.2 | Search student by name | 1. Go to **Students** page 2. Type a student's name in the search box | Table filters to show matching students only | | | |
| 2.3 | Edit student information | 1. Find a student in the list 2. Click **Edit** 3. Change any field 4. Click **Save** | Updated information is shown in the table | | | |
| 2.4 | Delete a student | 1. Find a student 2. Click **Delete** 3. Confirm deletion in the dialog | Student is removed from the list | | | |
| 2.5 | Enroll student face photo | 1. Open student detail 2. Upload a clear front-facing photo | Success message shown; student marked as face-enrolled | | | |

---

## Module 3 — Camera Attendance

| # | Scenario | Steps | Expected Result | Actual Result | Pass / Fail | Remarks |
|---|---|---|---|---|---|---|
| 3.1 | Start camera feed | 1. Go to **Camera** page 2. Click **Start Camera** | Browser requests camera permission; video feed appears | | | |
| 3.2 | Recognized student marks attendance | 1. Camera is running 2. A face-enrolled student stands in front of the camera | Green bounding box appears with student name and status; attendance is recorded in Dashboard | | | |
| 3.3 | Unknown face detected | 1. Camera is running 2. A person whose face is not enrolled faces the camera | Red bounding box with label "Unknown" | | | |
| 3.4 | Already-marked student is detected | 1. Camera is running 2. A student who was already marked today faces the camera | Cyan bounding box with label "Already Marked" | | | |
| 3.5 | Stop camera | 1. Camera is running 2. Click **Stop** | Video feed stops; scanning halts | | | |

---

## Module 4 — Dashboard & Reports

| # | Scenario | Steps | Expected Result | Actual Result | Pass / Fail | Remarks |
|---|---|---|---|---|---|---|
| 4.1 | Dashboard loads today's attendance | 1. Log in as admin 2. Go to **Dashboard** | List of students with today's attendance records is displayed | | | |
| 4.2 | Filter attendance by date | 1. On Dashboard, click the date picker 2. Select a past date | Table shows attendance records for that specific date only | | | |
| 4.3 | Stat cards match table data | 1. Note the Present / Late / Absent counts in the cards 2. Count rows in the table by status | Card counts match the table row counts | | | |
| 4.4 | Clear date filter | 1. After applying a date filter, click **Clear** | Dashboard reverts to today's records | | | |
| 4.5 | Student portal attendance rate | 1. Log in as a student 2. Check the attendance rate card | Percentage matches Present + Late out of total school days | | | |

---

## Module 5 — Notifications & Messaging

| # | Scenario | Steps | Expected Result | Actual Result | Pass / Fail | Remarks |
|---|---|---|---|---|---|---|
| 5.1 | SMS notification on attendance mark | 1. A student with a registered parent is recognized by camera 2. Wait a few seconds | Parent's phone receives an SMS with student name, status, and time | | | |
| 5.2 | Student sends message to admin | 1. Log in as a student 2. Click the **Contact Admin** button 3. Type a message 4. Click **Send** | Success confirmation shown inside the modal | | | |
| 5.3 | Admin sees incoming message | 1. Log in as admin 2. Go to **Messages** | Student's message appears in the list with a "New" badge | | | |
| 5.4 | Admin marks message as read | 1. On Messages page, click **Mark read** on an unread message | "New" badge disappears from that message | | | |

---

## Module 6 — Theme & Responsiveness

| # | Scenario | Steps | Expected Result | Actual Result | Pass / Fail | Remarks |
|---|---|---|---|---|---|---|
| 6.1 | Switch to light mode | 1. Click the sun/moon icon in the header | All page backgrounds, text, and icons switch to light colors | | | |
| 6.2 | Theme persists on refresh | 1. Switch to light (or dark) mode 2. Refresh the page (F5) | Same theme remains after reload; no flash to dark | | | |
| 6.3 | Admin dashboard on mobile | 1. Open the admin dashboard on a phone or resize browser to ~375px | Sidebar is hidden; hamburger ☰ button visible; tap it to open sidebar | | | |
| 6.4 | Sidebar closes on link click (mobile) | 1. Open sidebar on mobile 2. Tap any navigation link | Sidebar slides closed; correct page loads | | | |
| 6.5 | Student portal on mobile | 1. Open `/portal` on a phone | Profile card, attendance rate, and records are readable without horizontal overflow | | | |

---

## Overall Evaluation

| Criterion | Rating (1–5) | Comments |
|---|---|---|
| Ease of use for school staff | | |
| Accuracy of attendance recording | | |
| Speed and responsiveness of camera | | |
| Clarity of information displayed | | |
| Overall satisfaction with the system | | |

*Rating scale: 1 = Very Poor, 2 = Poor, 3 = Average, 4 = Good, 5 = Excellent*

---

## Summary

**Total Test Cases:** 28
**Passed:** ______ / 28
**Failed:** ______

**Issues found (if any):**

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Additional comments or suggestions:**

_______________________________________________
_______________________________________________
_______________________________________________

---

## Evaluator Sign-off

By signing below, I confirm that I have personally performed the test scenarios listed in this document.

**Evaluator Name:** ___________________________

**Signature:** ___________________________

**Date:** ___________________________

---

*AttendEase v1.0 — AMA Computer College Pangasinan Campus*
*Prepared for thesis evaluation purposes*
