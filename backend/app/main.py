from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import prices, chat, news, sentiment, advisor, portfolio
from app.routers import settings as settings_router

settings = get_settings()

app = FastAPI(title="nLab API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prices.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(news.router, prefix="/api/v1")
app.include_router(sentiment.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")
app.include_router(advisor.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
