"""Free recall alerts: subscriptions live in Tiger Data (Postgres); recalls come from NHTSA;
emails go out through Resend. POST /api/alerts/check is meant for a scheduler (Cloud Scheduler).
"""

import html
import json
import re
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
);
ALTER TABLE alert_subscriptions ADD COLUMN IF NOT EXISTS plan_path TEXT;
"""

# The email button links back to the driver's own plan: a sample driver, or the car and contract
# packed into the link (never income or bills). Anything else falls back to the home page.
PLAN_PATH = re.compile(r"^/plan\?(driver=[a-z]{1,20}|p=[A-Za-z0-9_-]{1,4000})$")


def plan_link(plan_path: str | None) -> str:
    app = get_settings().public_app_url.rstrip("/")
    return app + plan_path if plan_path and PLAN_PATH.match(plan_path) else app


async def init() -> None:
    for stmt in SCHEMA.split(";"):
        if stmt.strip():
            await tiger.query(stmt)


def _recall_ids(recalls: list[dict]) -> list[str]:
    return sorted({r.get("NHTSACampaignNumber") for r in recalls if r.get("NHTSACampaignNumber")})


def _email(car: str, recalls: list[dict], token: str, welcome: bool, plan_path: str | None = None) -> tuple[str, str]:
    app = get_settings().public_app_url.rstrip("/")
    unsubscribe = f"{app}/api/alerts/unsubscribe?token={token}"
    if recalls:
        items = "".join(
            f"<li style='margin-bottom:12px'><b>{html.escape(r.get('Component', 'Recall'))}</b><br>"
            f"{html.escape(r.get('Summary', ''))}<br><i>Fix: {html.escape(r.get('Remedy', 'Contact your dealer'))}</i></li>"
            for r in recalls[:5]
        )
        body = f"<p>There {'are' if len(recalls) != 1 else 'is'} {len(recalls)} open safety recall{'s' if len(recalls) != 1 else ''} for your {html.escape(car)}:</p><ul>{items}</ul>" \
               "<p>Recall repairs are free at authorized dealers for your brand.</p>"
    else:
        body = f"<p>Good news: there are no open safety recalls for your {html.escape(car)} right now.</p>"
    intro = (f"<p>You're signed up for free recall alerts for your {html.escape(car)}. We'll email you if there's "
             "a new safety recall.</p>") if welcome else ""
    subject = (f"Recall alerts are on for your {car}" if welcome
               else f"New recall for your {car}")
    page = (
        "<div style=\"font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;color:#000\">"
        "<div style='border-top:4px solid #EB0A1E;padding-top:16px'><h2 style='margin:0 0 12px'>CarPlan</h2></div>"
        f"{intro}{body}"
        f"<p><a href='{html.escape(plan_link(plan_path))}' style='background:#EB0A1E;color:#fff;padding:12px 20px;border-radius:60px;"
        "text-decoration:none;display:inline-block'>See your plan</a></p>"
        f"<p style='color:#58595B;font-size:12px'>You're receiving this because you turned on recall alerts at CarPlan. "
        f"<a href='{unsubscribe}' style='color:#58595B'>Unsubscribe</a></p></div>"
    )
    return subject, page


async def subscribe(email: str, year: int, make: str, model: str, vin: str | None, plan_path: str | None = None) -> dict:
    await init()
    recalls = await nhtsa.recalls(make, model, year)
    token = secrets.token_urlsafe(24)
    if plan_path and not PLAN_PATH.match(plan_path):
        plan_path = None
    rows = await tiger.query(
        """INSERT INTO alert_subscriptions (email, year, make, model, vin, token, known_recalls, plan_path)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT (email, year, make, model) DO UPDATE SET vin = EXCLUDED.vin, plan_path = EXCLUDED.plan_path
           RETURNING token""",
        (email.strip().lower(), year, make, model, vin, token, json.dumps(_recall_ids(recalls)), plan_path),
    )
    token = rows[0]["token"]
    car = f"{year} {make.title()} {model}"
    sent, error = False, None
    if resend.configured():
        try:
            subject, page = _email(car, recalls, token, welcome=True, plan_path=plan_path)
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
            subject, page = _email(f"{s['year']} {s['make'].title()} {s['model']}", new, s["token"], welcome=False,
                                   plan_path=s.get("plan_path"))
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
