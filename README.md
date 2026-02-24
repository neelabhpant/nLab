# FinPlan

Personal financial planning platform with crypto price tracking, AI-powered chat agent, and normalized chart overlays.

## Prerequisites

- Node.js 18+
- Python 3.11+

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173

## Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi "uvicorn[standard]" httpx anthropic python-dotenv pydantic pydantic-settings cachetools
cp .env.example .env  # then fill in your API keys
uvicorn app.main:app --reload
```

Runs on http://localhost:8000

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `COINGECKO_API_URL` | CoinGecko API base URL |
| `CORS_ORIGINS` | Comma-separated allowed origins |

## Development

Run both servers simultaneously:

```bash
# Terminal 1
cd frontend && npm run dev

# Terminal 2
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload
```
