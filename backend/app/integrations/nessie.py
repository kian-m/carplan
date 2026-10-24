"""Capital One Nessie mock-banking API. Docs: http://api.nessieisreal.com/documentation"""

from typing import Any

import httpx

from app.config import get_settings
from app.integrations import NotConfigured


def configured() -> bool:
    return bool(get_settings().nessie_api_key)


async def _request(method: str, path: str, json: dict | None = None) -> Any:
    s = get_settings()
    if not s.nessie_api_key:
        raise NotConfigured("Nessie", "NESSIE_API_KEY")
    async with httpx.AsyncClient(base_url=s.nessie_base_url, timeout=15) as client:
        r = await client.request(method, path, params={"key": s.nessie_api_key}, json=json)
        r.raise_for_status()
        return r.json() if r.content else None


async def list_customers() -> list[dict]:
    return await _request("GET", "/customers")


async def get_customer(customer_id: str) -> dict:
    return await _request("GET", f"/customers/{customer_id}")


async def list_accounts(customer_id: str) -> list[dict]:
    return await _request("GET", f"/customers/{customer_id}/accounts")


async def list_bills(account_id: str) -> list[dict]:
    return await _request("GET", f"/accounts/{account_id}/bills")


async def list_purchases(account_id: str) -> list[dict]:
    return await _request("GET", f"/accounts/{account_id}/purchases")


async def list_deposits(account_id: str) -> list[dict]:
    return await _request("GET", f"/accounts/{account_id}/deposits")


async def create_customer(first_name: str, last_name: str, address: dict) -> dict:
    """address: {street_number, street_name, city, state, zip}"""
    body = {"first_name": first_name, "last_name": last_name, "address": address}
    return (await _request("POST", "/customers", body))["objectCreated"]


async def create_account(customer_id: str, nickname: str, balance: int, type_: str = "Checking") -> dict:
    """type_: "Checking" | "Savings" | "Credit Card"."""
    body = {"type": type_, "nickname": nickname, "rewards": 0, "balance": balance}
    return (await _request("POST", f"/customers/{customer_id}/accounts", body))["objectCreated"]


async def create_bill(account_id: str, payee: str, amount: float, recurring_day: int, nickname: str = "") -> dict:
    body = {
        "status": "pending",
        "payee": payee,
        "nickname": nickname or payee,
        "payment_amount": amount,
        "recurring_date": recurring_day,
    }
    return (await _request("POST", f"/accounts/{account_id}/bills", body))["objectCreated"]


async def financial_snapshot(customer_id: str) -> dict:
    """One call that gathers everything about a customer — handy for feeding an LLM."""
    customer = await get_customer(customer_id)
    accounts = await list_accounts(customer_id)
    for acct in accounts:
        acct["bills"] = await list_bills(acct["_id"])
        acct["purchases"] = await list_purchases(acct["_id"])
    return {"customer": customer, "accounts": accounts}
