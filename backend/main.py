import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from schemas.openai import (ChatCompletionRequest,GuardTraceResponse)
from ml.risk_classifier import risk_classifier
from core.cache import cache_engine
from gemini_client import gemini_client

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


app = FastAPI(
    title="GuardTraceAi",
    description="AI Gateway with PII detection, risk classification and caching",
    version="1.0.0", 
    lifespan=lifespan
)

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

@app.post("/inspect")
async def inspect_prompt(request: ChatCompletionRequest):

    text = " ".join(
        message.content
        for message in request.messages
    )

    inspection = risk_classifier.inspect_prompt(text)
    return inspection


@app.post("/chat/completions", response_model=GuardTraceResponse)
async def chat_completion(request: ChatCompletionRequest):
    cache_key = cache_engine.generate_cache_key(
        model=request.model,
        messages=request.messages
    )
    cached_response = await cache_engine.get_cached_response(cache_key)
    if cached_response is not None:
        print("Cache HIT") # Add information that response came from cache 
        cached_response["guardtrace_meta"]["action_taken"] = "cache_hit" 
        return cached_response
    print("cache miss")
    text = " ".join( message.content for message in request.messages )
    inspection = risk_classifier.inspect_prompt(text)
    print("Risk Score:", inspection["risk_score"]) 
    print("Detected PII:", inspection["detected_pii"])

    if not inspection["is_safe"]:
        raise HTTPException( status_code=400, detail={ "message": "Request blocked by GuardTraceAI", "risk_score": inspection["risk_score"], "detected_pii": inspection["detected_pii"], "action_taken": "blocked" })

    try:
        response = await gemini_client.generate(
                model = request.model, 
                messages = request.messages,
                temperature = request.temperature,
                top_p = request.top_p,
                max_tokens = request.max_tokens)
    except Exception as e:
        print("Gemini API Error")
        str(e)
        raise HTTPException(
                status_code=502,
                detail={
                    "message": "Gemini API request failed", 
                    "error": str(e)
                }
        )

    response_data = {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()), 
        "model": request.model, 
        "choices": [ { "index": 0, "message": { "role": "assistant", "content": response }, "finish_reason": "stop" } ], 
        "usage": None, 
        "guardtrace_meta": { "is_safe": inspection["is_safe"], "risk_score": inspection["risk_score"], "detected_pii": inspection["detected_pii"], "action_taken": "allowed" } 
        }
    
    await cache_engine.set_cached_response(
        cache_key,
        response_data
    )

    print("response cached in Redis")

    return response_data
    

