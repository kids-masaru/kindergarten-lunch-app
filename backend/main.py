from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import router
from backend.scheduler import create_scheduler
import os

app = FastAPI(title="Kindergarten Lunch Order API")

_scheduler = create_scheduler()

@app.on_event("startup")
async def startup_event():
    _scheduler.start()
    print("[SCHEDULER] スケジューラーを起動しました（毎朝8:00 月次リマインダー）。")

@app.on_event("shutdown")
async def shutdown_event():
    _scheduler.shutdown()
    print("[SCHEDULER] スケジューラーを停止しました。")

# CORS Setup
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://kindergarten-lunch-app.vercel.app",  # Production Frontend URL
    "*" # For development convenience
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Kindergarten Lunch Order API is running"}
