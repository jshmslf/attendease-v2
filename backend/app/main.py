import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.session import engine
from app.db import base  # noqa: F401 - imports all models for SQLAlchemy
from app.api.routes import auth, students, attendance, camera, notifications, messages


# Create storage directory at import time so StaticFiles mount succeeds
os.makedirs(settings.LOCAL_STORAGE_PATH, exist_ok=True)
os.makedirs("static", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"AttendEase API starting up... Face storage: {settings.LOCAL_STORAGE_PATH}")
    yield
    print("AttendEase API shutting down...")


app = FastAPI(
    title="AttendEase API",
    description="Gateway camera-based attendance system",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve locally stored face images
app.mount("/static", StaticFiles(directory="static", html=False), name="static")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(students.router, prefix="/api/students", tags=["students"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["attendance"])
app.include_router(camera.router, prefix="/api/camera", tags=["camera"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "AttendEase API"}
