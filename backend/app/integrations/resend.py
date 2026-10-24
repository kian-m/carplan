"""Resend transactional email. Docs: https://resend.com/docs/api-reference/emails/send-email"""

import httpx

from app.config import get_settings
from app.integrations import NotConfigured


def configured() -> bool:
    return bool(get_settings().resend_api_key)


async def send(to: str, subject: str, html: str) -> dict:
    s = get_settings()
    if not s.resend_api_key:
        raise NotConfigured("Resend", "RESEND_API_KEY")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={"from": s.alerts_from_email, "to": [to], "subject": subject, "html": html},
        )
        r.raise_for_status()
        return r.json()
