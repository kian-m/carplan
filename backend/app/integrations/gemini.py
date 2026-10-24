"""Google Gemini via the google-genai SDK. Docs: https://ai.google.dev/gemini-api/docs"""

import json
from typing import Any

from google import genai
from google.genai import types

from app.config import get_settings
from app.integrations import NotConfigured

_client: genai.Client | None = None


def configured() -> bool:
    return bool(get_settings().gemini_api_key)


def _thinking() -> types.ThinkingConfig | None:
    # "low" roughly halves latency for short explanations; contract extraction uses the model default.
    level = get_settings().gemini_thinking_level
    return types.ThinkingConfig(thinking_level=level) if level else None


def _get_client() -> genai.Client:
    global _client
    s = get_settings()
    if not s.gemini_api_key:
        raise NotConfigured("Gemini", "GEMINI_API_KEY")
    if _client is None:
        _client = genai.Client(api_key=s.gemini_api_key, vertexai=s.gemini_vertex)
    return _client


async def generate(prompt: str, system: str | None = None) -> str:
    resp = await _get_client().aio.models.generate_content(
        model=get_settings().gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=system, thinking_config=_thinking()),
    )
    return resp.text or ""


async def generate_json(prompt: str, schema: dict[str, Any], system: str | None = None) -> Any:
    """Structured output: `schema` is a JSON schema the response must match."""
    resp = await _get_client().aio.models.generate_content(
        model=get_settings().gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=schema,
            thinking_config=_thinking(),
        ),
    )
    return json.loads(resp.text or "null")


async def extract_from_file(data: bytes, mime_type: str, prompt: str, schema: dict[str, Any]) -> Any:
    """Read a PDF or image and return JSON matching `schema`."""
    resp = await _get_client().aio.models.generate_content(
        model=get_settings().gemini_model,
        contents=[types.Part.from_bytes(data=data, mime_type=mime_type), prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=schema,
        ),
    )
    return json.loads(resp.text or "null")


async def chat(messages: list[dict[str, str]], system: str | None = None) -> str:
    """messages: [{"role": "user" | "model", "text": "..."}]"""
    contents = [types.Content(role=m["role"], parts=[types.Part(text=m["text"])]) for m in messages]
    resp = await _get_client().aio.models.generate_content(
        model=get_settings().gemini_model,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=system, thinking_config=_thinking()),
    )
    return resp.text or ""
