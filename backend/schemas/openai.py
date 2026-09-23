from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# 1 Represent a single chat message (role + content)
class ChatMessage(BaseModel):
    role: str
    content: str
    name: Optional[str] = None

# 2 Represents the incoming request Structure
class ChatCompletionRequest(BaseModel):
    model: str = "gemini-1.5-flash"
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 1.0
    n: Optional[int] = 1
    stream: Optional[bool] = False
    max_tokens: Optional[int] = None
    presence_penalty: Optional[float] = 0.0
    frequency_penalty: Optional[float] = 0.0
    user: Optional[str] = None

# 3 Custom data attached by the application after inspection and answers predicted by models
class InspectionMetaData(BaseModel):
    is_safe: bool
    risk_score: float
    detected_pii: List[str]
    action_taken: str

# 4 The final response returned to the caller
class GuardTraceResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Optional[Dict[str, int]] = None
    guardtrace_meta: InspectionMetaData


