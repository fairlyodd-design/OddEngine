from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ready"}

@app.get("/status")
def status():
    return {"status": "running"}

@app.get("/ready")
def ready():
    return {"status": "ready"}

# --- START SERVER FIX ---
if __name__ == "__main__":
    import uvicorn
    print("🔥 Starting Homie Bridge on http://127.0.0.1:8765")
    uvicorn.run(app, host="127.0.0.1", port=8765)
