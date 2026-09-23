from typing import List

from google import genai
from google.genai import types

from config import settings
from schemas.openai import ChatMessage


class GeminiClient:

    def __init__(self):
        """
        Initialize the Gemini API client.
        """

        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

    async def generate_response(
        self,
        model: str,
        messages: List[ChatMessage],
        temperature: float = 0.7,
        top_p: float = 1.0,
        max_tokens: int | None = None
    ) -> str:
        """
        Sends the conversation to Gemini and returns
        the generated text.
        """

        # -------------------------------------------------
        # Convert OpenAI-style messages into Gemini format
        # -------------------------------------------------

        contents = []

        for message in messages:

            contents.append(
                types.Content(
                    role=self._convert_role(message.role),
                    parts=[
                        types.Part(
                            text=message.content
                        )
                    ]
                )
            )

        # -------------------------------------------------
        # Generation configuration
        # -------------------------------------------------

        config = types.GenerateContentConfig(
            temperature=temperature,
            top_p=top_p,
            max_output_tokens=max_tokens
        )

        # -------------------------------------------------
        # Call Gemini
        # -------------------------------------------------

        response = self.client.models.generate_content(
            model=model,
            contents=contents,
            config=config
        )

        # -------------------------------------------------
        # Return generated text
        # -------------------------------------------------

        return response.text

    @staticmethod
    def _convert_role(role: str) -> str:
        """
        Convert OpenAI-style roles into Gemini roles.

        OpenAI:
            user
            assistant
            system

        Gemini content roles:
            user
            model
        """

        if role == "assistant":
            return "model"

        if role == "user":
            return "user"

        # Gemini's generate_content contents do not use
        # "system" as a normal conversation role.
        #
        # For now, treat unknown roles as user.
        return "user"


# Global Gemini client instance
gemini_client = GeminiClient()
