from dataclasses import dataclass
from typing import List

from google import genai
from google.genai import types

from config import settings
from schemas.openai import ChatMessage


@dataclass
class GeminiResult:
    text: str
    model: str
    prompt_tokens: int
    completion_tokens: int


class GeminiClient:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def generate_response(
        self,
        model: str | None,
        messages: List[ChatMessage],
        temperature: float = 0.7,
        top_p: float = 1.0,
        max_tokens: int | None = None,
    ) -> GeminiResult:
        model = model or settings.DEFAULT_MODEL

        system_parts = []
        contents = []
        for message in messages:
            if message.role == "system":
                system_parts.append(message.content)
                continue
            contents.append(
                types.Content(
                    role="model" if message.role == "assistant" else "user",
                    parts=[types.Part(text=message.content)],
                )
            )

        config = types.GenerateContentConfig(
            temperature=temperature,
            top_p=top_p,
            max_output_tokens=max_tokens,
            system_instruction="\n".join(system_parts) if system_parts else None,
        )

        response = await self.client.aio.models.generate_content(
            model=model, contents=contents, config=config
        )

        usage = response.usage_metadata
        prompt_tokens = (usage.prompt_token_count or 0) if usage else 0
        # "Thinking" tokens are billed as output, so count them too
        completion_tokens = (
            ((usage.candidates_token_count or 0) + (getattr(usage, "thoughts_token_count", 0) or 0))
            if usage
            else 0
        )

        return GeminiResult(
            text=response.text or "I couldn't generate a response for that message.",
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )


gemini_client = GeminiClient()