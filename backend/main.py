from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import router
import os

app = FastAPI(title="Kindergarten Lunch Order API")

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

app.include_router(router.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Kindergarten Lunch Order API is running"}
