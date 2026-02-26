import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import prices, chat, news, sentiment, advisor, portfolio, auth, vault
from app.routers import settings as settings_router
from app.services.auth import verify_token
from app.services.vault_storage import VaultStorage
from app.services.vault_memory import VaultMemory
from app.routers.vault import init_vault

logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(title="nLab API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUTH_EXEMPT_PREFIXES = ("/api/v1/auth/", "/api/v1/health")


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Require valid JWT for all /api/v1/ routes except auth and health."""
    path = request.url.path

    if request.method == "OPTIONS":
        return await call_next(request)

    if path.startswith("/api/v1/") and not any(path.startswith(p) for p in AUTH_EXEMPT_PREFIXES):
        token = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        if not token:
            token = request.query_params.get("token")

        if not token:
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        user = verify_token(token)
        if not user:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        request.state.user = user

    return await call_next(request)


app.include_router(auth.router, prefix="/api/v1")
app.include_router(prices.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(news.router, prefix="/api/v1")
app.include_router(sentiment.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")
app.include_router(advisor.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")
app.include_router(vault.router, prefix="/api/v1")


@app.on_event("startup")
async def startup_vault() -> None:
    """Initialize vault storage and memory on startup."""
    storage = VaultStorage()
    await storage.init_db()
    try:
        memory = VaultMemory()
        if not memory.available:
            memory = None
    except Exception:
        logger.warning("Vault memory (Mem0) unavailable — running without semantic search")
        memory = None
    init_vault(storage, memory)
    logger.info("Vault initialized")


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
