# nLab

A personal interest spaces platform with multiple workspaces (Finance, Retail Intelligence, and Labs) powered by AI agents, real-time data, and a dark-first UI.

## Spaces

### Finance
- **Market Overview**: Live crypto/stock price tracking with sparklines, sentiment gauges, and market briefs
- **Market Chat**: Conversational interface for market questions, backed by a multi-agent CrewAI system
- **Trading**: Alpaca paper trading with live order placement and portfolio tracking
- **AI Trading Agents**: Multi-agent crews that analyze technicals, fundamentals, and execute trading strategies
- **Financial Advisor**: AI financial planning with goal-based recommendations
- **Financial Roadmap**: Interactive milestone-based financial planning timeline
- **Price Forecast**: AI price prediction with confidence intervals
- **Normalized Chart Overlays**: Compare any two assets on a single axis using min-max or z-score normalization

### Retail Intelligence
- **Daily Digest**: AI-summarized retail industry news from 10+ RSS sources, generated daily
- **Article Feed**: Full article analysis with AI summarization and key takeaway extraction
- **Retail Chat**: Conversational AI for retail strategy questions with persistent memory
- **Use Case Sparks**: AI-generated technology use case ideas with confidence scoring and PDF newsletter export
- **Newsletter**: Generate polished PDF newsletters from Use Case Sparks and email them to peers
- **Sources**: Configurable RSS feed management

### Labs
- **OpenClaw Lite**: Configurable AI agent with toggleable skills:
  - **Core Skills**: Web search, calculator, memory, URL fetcher, text analyzer, note taker
  - **Communication**: Email sending with file attachment support
  - **File Generation**: PDF and CSV report generation
  - **Local System (Tier 1)**: File explorer, system monitor, local search, git status, clipboard read (sandboxed, read-only)
  - **Local System (Tier 2)**: File writer, shell runner, app launcher (requires user confirmation)
  - **Browser Agent**: Autonomous web browsing via browser-use (Playwright + LLM). Persistent login sessions, works with any website (LinkedIn, Slack, Gmail, etc.)
  - SOUL.md personality editor for agent customization
  - Real-time execution viewer with streaming skill events
- **Workshop**: AI agent builder with custom tool configuration
- **Function to Music**: Mathematical function sonification experiment
- **Project Gallery**: Showcase of lab experiments

### Shared
- **Vault**: Document intelligence system. Upload PDFs, DOCX, XLSX and chat with them via ChromaDB vector search.
- **Settings**: LLM provider configuration (OpenAI, Anthropic, Groq) with model selection
- **Google OAuth**: Authentication with allowed-email gating

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (heavily customized dark theme) |
| Charts | Recharts + TradingView Lightweight Charts |
| Animations | Framer Motion |
| State | Zustand |
| Backend | FastAPI (Python 3.11+) |
| AI Agents | CrewAI + OpenAI / Anthropic / Groq (configurable) |
| Browser Automation | browser-use + Playwright |
| Vector DB | ChromaDB |
| Trading | Alpaca Markets API (paper trading) |
| Data Sources | CoinGecko, FRED, Yahoo Finance, RSS feeds, DuckDuckGo |
| Auth | Google OAuth 2.0 + JWT |
| Email | SMTP (Gmail App Passwords) |

## Prerequisites

- Node.js 18+
- Python 3.11+
- Chromium (auto-installed via `playwright install chromium`)

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env  # fill in your API keys
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Create `backend/.env` with:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GROQ_API_KEY` | Groq API key |
| `FRED_API_KEY` | FRED economic data API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `JWT_SECRET` | JWT signing secret |
| `ALLOWED_EMAILS` | Comma-separated allowed login emails |
| `ALPACA_API_KEY` | Alpaca paper trading API key |
| `ALPACA_SECRET_KEY` | Alpaca paper trading secret |
| `SMTP_HOST` | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (default `587`) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password (Gmail App Password) |
| `SMTP_FROM_EMAIL` | Sender email address |
| `LOCAL_ALLOWED_PATHS` | Comma-separated paths for local system skills |
| `LOCAL_SHELL_ALLOWLIST` | Comma-separated allowed shell commands |
| `BROWSER_PROFILE_DIR` | Persistent browser session profile directory |

## Development

Run both servers simultaneously:

```bash
# Terminal 1 - Frontend (port 5173)
cd frontend && npm run dev

# Terminal 2 - Backend (port 8000)
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

## Architecture

```
frontend/src/
├── shared/              # Layout, auth, vault, settings, API client
├── spaces/
│   ├── registry.ts      # Space definitions
│   ├── finance/         # Market data, trading, advisors, forecasting
│   ├── retail/          # RSS intelligence, digest, sparks, newsletter
│   └── labs/            # OpenClaw, workshop, experiments
└── App.tsx              # Route definitions

backend/app/
├── routers/             # FastAPI endpoints
├── services/            # Business logic, AI agents, tools
├── models/              # Pydantic models
└── config.py            # Environment settings
```
