from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from core.cache import cache_engine

from routes.auth import router as auth_router
from routes.conversation import router as conversation_router
from routes.message import router as message_router
from routes.chat import router as chat_router
from routes.admin import router as admin_router
from routes.admin_analytics import router as admin_analytics_router
from config import settings
from ml.risk_classifier import risk_classifier

@asynccontextmanager
async def lifespan(app: FastAPI):
    # connect to Redis when application starts
    await cache_engine.connect()

    print("GuardTraceAi Started")
    print(" Redis Connected ")

    yield

    await cache_engine.close()
    print("GuardTraceAI stopped") 
    print("Redis connection closed")

risk_classifier.warm_up() 

app = FastAPI(
    title="GuardTraceAi",
    description="AI Gateway with PII detection, risk classification and caching",
    version="1.0.0", 
    lifespan=lifespan
)


@app.middleware("http")
async def strip_api_prefix(request: Request, call_next):
    # The deployed frontend calls /api/..., but every route here is mounted at
    # the root (/auth/register, /chat, ...). Accept both forms.
    path = request.scope["path"]
    if path == "/api" or path.startswith("/api/"):
        path = path[len("/api"):] or "/"
        request.scope["path"] = path
        request.scope["raw_path"] = path.encode("utf-8")
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conversation_router)
app.include_router(auth_router)
app.include_router(message_router)
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(admin_analytics_router)



@app.get('/')
async def root():
    return {
        "message": "GuardTraceAI is running",
        "status": "ok"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }
