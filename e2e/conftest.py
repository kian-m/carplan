"""End-to-end tests drive the real app in Chrome, through the frontend and its API proxy.

    cd backend && uv run --group e2e pytest ../e2e                       # local (localhost:3000)
    cd backend && E2E_URL=https://carplan.tech uv run --group e2e pytest ../e2e
"""

import os
from pathlib import Path

import pytest

BASE_URL = os.environ.get("E2E_URL", "http://localhost:3000").rstrip("/")
SAMPLES = Path(__file__).parent.parent / "samples"
TEST_EMAIL = "delivered@resend.dev"  # Resend's test inbox: accepts mail, delivers to no one


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args):
    # Use the installed Chrome so no Playwright browser download is needed.
    return {**browser_type_launch_args, "channel": "chrome"}


@pytest.fixture
def page(page):
    page.set_default_timeout(30_000)
    return page
