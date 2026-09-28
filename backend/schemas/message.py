from pydantic import BaseModel

class CreateMessageRequest(BaseModel):
    role: str
    content: str