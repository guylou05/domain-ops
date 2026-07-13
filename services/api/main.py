from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="DomainScout AI Analysis Service", version="0.1.0")

class ScoreRequest(BaseModel):
    domain: str
    industry: str = "general"

@app.get('/health')
def health():
    return {"status": "ok"}

@app.post('/score')
def score(req: ScoreRequest):
    label = req.domain.split('.')[0]
    score = max(0, min(100, 40 + len(req.industry) + max(0, 16 - len(label))))
    return {"domain": req.domain, "score": score, "explanation": "Deterministic development scoring adapter."}
