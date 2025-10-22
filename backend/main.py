from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import requests
import os

app = FastAPI()

# Allow frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COINGECKO_API = "https://api.coingecko.com/api/v3"

@app.get("/coins")
def get_coins():
    url = f"{COINGECKO_API}/coins/markets"
    params = {
        "vs_currency": "usd",
        "order": "market_cap_desc",
        "per_page": 50,
        "page": 1,
        "sparkline": False,
        "price_change_percentage": "24h"
    }
    r = requests.get(url, params=params)
    return r.json()

@app.get("/coin/{coin_id}/chart")
def get_chart(coin_id: str):
    url = f"{COINGECKO_API}/coins/{coin_id}/market_chart"
    params = {
        "vs_currency": "usd",
        "days": 7
    }
    r = requests.get(url, params=params)
    return r.json()

# Path to your frontend folder
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")

# Serve all files (HTML, JS, CSS)
app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(frontend_dir, "index.html"))