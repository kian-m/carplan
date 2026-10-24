"""Free recall alerts: subscriptions live in Tiger Data (Postgres); recalls come from NHTSA;
emails go out through Resend. POST /api/alerts/check is meant for a scheduler (Cloud Scheduler).
"""

import html
import json
import secrets

from app.config import get_settings
from app.integrations import nhtsa, resend, tiger

SCHEMA = """
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL,
    year          INT  NOT NULL,
    make          TEXT NOT NULL,
    model         TEXT NOT NULL,
    vin           TEXT,
    token         TEXT NOT NULL UNIQUE,
    known_recalls JSONB NOT NULL DEFAULT '[]',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (email, year, make, model)
)
"""


async def init() -> None:
    await tiger.query(SCHEMA)


def _recall_ids(recalls: list[dict]) -> list[str]:
    return sorted({r.get("NHTSACampaignNumber") for r in recalls if r.get("NHTSACampaignNumber")})


def _email(car: str, recalls: list[dict], token: str, welcome: bool) -> tuple[str, str]:
    app = get_settings().public_app_url.rstrip("/")
    unsubscribe = f"{app}/api/alerts/unsubscribe?token={token}"
    if recalls:
        items = "".join(
            f"<li style='margin-bottom:12px'><b>{html.escape(r.get('Component', 'Recall'))}</b><br>"
            f"{html.escape(r.get('Summary', ''))}<br><i>Fix: {html.escape(r.get('Remedy', 'Contact your dealer'))}</i></li>"
            for r in recalls[:5]
        )
        body = f"<p>NHTSA lists {len(recalls)} recall{'s' if len(recalls) != 1 else ''} for your {html.escape(car)}:</p><ul>{items}</ul>" \
               "<p>Recall repairs are free at any authorized dealer.</p>"
    else:
        body = f"<p>Good news: there are no open NHTSA recalls for your {html.escape(car)} right now.</p>"
    intro = (f"<p>You're signed up for free recall alerts for your {html.escape(car)}. We'll email you if NHTSA "
             "issues a new recall.</p>") if welcome else ""
    subject = (f"Recall alerts are on for your {car}" if welcome
               else f"New recall for your {car}")
    page = (
        "<div style=\"font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;color:#000\">"
        "<div style='border-top:4px solid #EB0A1E;padding-top:16px'><h2 style='margin:0 0 12px'>CarPlan</h2></div>"
        f"{intro}{body}"
        f"<p><a href='{app}' style='background:#EB0A1E;color:#fff;padding:12px 20px;border-radius:60px;"
        "text-decoration:none;display:inline-block'>See your car's next move</a></p>"
        f"<p style='color:#58595B;font-size:12px'>You're receiving this because you turned on recall alerts at CarPlan. "
        f"<a href='{unsubscribe}' style='color:#58595B'>Unsubscribe</a></p></div>"
    )
    return subject, page


async def subscribe(email: str, year: int, make: str, model: str, vin: str | None) -> dict:
    await init()
    recalls = await nhtsa.recalls(make, model, year)
    token = secrets.token_urlsafe(24)
    rows = await tiger.query(
        """INSERT INTO alert_subscriptions (email, year, make, model, vin, token, known_recalls)
           VALUES (%s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT (email, year, make, model) DO UPDATE SET vin = EXCLUDED.vin
           RETURNING token""",
        (email.strip().lower(), year, make, model, vin, token, json.dumps(_recall_ids(recalls))),
    )
    token = rows[0]["token"]
    car = f"{year} {make.title()} {model}"
    sent, error = False, None
    if resend.configured():
        try:
            subject, page = _email(car, recalls, token, welcome=True)
            await resend.send(email, subject, page)
            sent = True
        except Exception as e:  # subscription is saved either way
            error = str(e)
    return {"subscribed": True, "open_recalls": len(recalls), "email_sent": sent, "email_error": error}


async def unsubscribe(token: str) -> bool:
    await init()
    rows = await tiger.query("DELETE FROM alert_subscriptions WHERE token = %s RETURNING id", (token,))
    return bool(rows)


async def check() -> dict:
    """Email subscribers about recalls that appeared since we last checked."""
    await init()
    subs = await tiger.query("SELECT * FROM alert_subscriptions")
    notified = 0
    for s in subs:
        recalls = await nhtsa.recalls(s["make"], s["model"], s["year"])
        ids = _recall_ids(recalls)
        new = [r for r in recalls if r.get("NHTSACampaignNumber") not in set(s["known_recalls"])]
        if new and resend.configured():
            subject, page = _email(f"{s['year']} {s['make'].title()} {s['model']}", new, s["token"], welcome=False)
            await resend.send(s["email"], subject, page)
            notified += 1
        await tiger.query("UPDATE alert_subscriptions SET known_recalls = %s WHERE id = %s", (json.dumps(ids), s["id"]))
    return {"subscriptions": len(subs), "notified": notified}


async def stats() -> dict:
    await init()
    rows = await tiger.query(
        """SELECT count(*) AS total, count(*) FILTER (WHERE lower(make) <> 'toyota') AS non_toyota
           FROM alert_subscriptions"""
    )
    return rows[0]
