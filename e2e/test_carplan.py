"""CarPlan end to end: every path a driver can take, checked in a real browser."""

import base64
import json
import re

import httpx
import pytest
from playwright.sync_api import Page, expect

from conftest import SAMPLES, TEST_EMAIL

GAP_URL = "https://www.toyotafinancial.com/us/en/vehicle_protection_plan/guaranteed_auto_protection.html"


def open_plan(page: Page, base_url: str, driver: str) -> None:
    page.goto(f"{base_url}/plan?driver={driver}")
    expect(page.locator("#options article").first).to_be_visible()


def best_card(page: Page):
    return page.locator("#options article").filter(has_text="Best for you")


def all_in(page: Page) -> str:
    return best_card(page).locator("p").filter(has_text="/mo all-in").inner_text()


# --- home ----------------------------------------------------------------

def test_home_offers_both_paths_and_sample_drivers(page: Page, base_url):
    page.goto(base_url)
    expect(page.get_by_role("heading", level=1)).to_contain_text("next move")
    expect(page.get_by_role("link", name=re.compile("I drive a Toyota"))).to_have_attribute("href", "/start?path=toyota")
    expect(page.get_by_role("link", name=re.compile("I drive another brand"))).to_have_attribute("href", "/start?path=other")
    for name in ("Maria Lopez", "Sam Patel", "Jordan Kim", "Taylor Nguyen", "Alex Rivera", "Bob Ross"):
        expect(page.get_by_text(name)).to_be_visible()


# --- sample drivers: each gets its own, honest answer ----------------------

@pytest.mark.parametrize("driver, best, count", [
    ("maria", "Buy out your lease", 3),
    ("sam", "Keep your car", 2),  # no Certified Used: it would be the same 2024 Corolla Hybrid he has
    ("jordan", "Buy out your lease", 3),  # his CR-V is worth more than the buyout, so keeping it is cheapest
    ("alex", "Keep your car", 3),
    ("bob", "Certified Used Corolla Hybrid", 3),  # a high-rate loan makes a lower-rate used hybrid cheapest  # an old Civic that's almost paid off: keeping it is cheapest
])
def test_each_sample_driver_gets_the_right_recommendation(page: Page, base_url, driver, best, count):
    open_plan(page, base_url, driver)
    expect(page.locator("#options article")).to_have_count(count)
    expect(best_card(page)).to_contain_text(best)
    # Gemini's explanation (or the template) replaces the loading skeleton
    expect(page.get_by_label("Writing your explanation")).to_have_count(0, timeout=30_000)
    expect(page.locator("h1")).not_to_be_empty()


def test_underwater_loan_leads_with_gap(page: Page, base_url):
    open_plan(page, base_url, "sam")
    gap = page.get_by_text("Protect yourself with GAP")
    expect(gap).to_be_visible()
    expect(page.get_by_role("link", name="Learn about GAP")).to_have_attribute("href", GAP_URL)
    # the main button says where it goes
    expect(page.get_by_role("link", name="Explore GAP coverage")).to_have_attribute("href", GAP_URL)
    expect(page.get_by_text(re.compile(r"^\$[\d,]+ more than it.s worth$"))).to_be_visible()


def test_negative_equity_rolled_into_a_used_toyota_leads_with_gap(page: Page, base_url):
    open_plan(page, base_url, "bob")
    expect(best_card(page)).to_contain_text("Certified Used Corolla Hybrid")
    expect(page.get_by_role("link", name="Explore GAP coverage").first).to_have_attribute("href", GAP_URL)


def test_driver_with_equity_gets_no_gap_warning(page: Page, base_url):
    open_plan(page, base_url, "maria")
    expect(page.get_by_text(re.compile(r"^\$[\d,]+ in equity$"))).to_be_visible()
    expect(page.get_by_text("Protect yourself with GAP")).to_have_count(0)


def test_show_the_math_adds_up(page: Page, base_url):
    open_plan(page, base_url, "maria")
    card = best_card(page)
    card.get_by_role("button", name="Show the math").click()
    rows = card.locator("dl div")
    values = [float(re.sub(r"[^\d.-]", "", t.split("\n")[-1]).replace("--", "-") or 0)
              for t in rows.all_inner_texts()]
    *parts, total = values
    assert abs(sum(parts) - total) <= len(parts), f"breakdown {parts} does not add up to {total}"


# --- sliders ---------------------------------------------------------------

def test_value_slider_updates_costs_and_explanation(page: Page, base_url):
    open_plan(page, base_url, "maria")
    expect(page.get_by_label("Writing your explanation")).to_have_count(0, timeout=30_000)
    before_cost, before_summary = all_in(page), page.locator("h1 + p").inner_text()
    page.locator("#value").focus()
    for _ in range(50):
        page.keyboard.press("ArrowLeft")
    expect(page.get_by_text("Updating for your changes")).to_be_visible()
    expect(best_card(page).locator("p").filter(has_text="/mo all-in")).not_to_have_text(before_cost)
    expect(page.get_by_text("Updating for your changes")).to_have_count(0, timeout=30_000)
    assert page.locator("h1 + p").inner_text() != before_summary


def test_mileage_slider_changes_lease_overage(page: Page, base_url):
    open_plan(page, base_url, "maria")
    note = page.get_by_text(re.compile(r"miles over your lease limit"))
    before = note.inner_text()
    page.locator("#miles").focus()
    for _ in range(10):
        page.keyboard.press("ArrowRight")
    expect(note).not_to_have_text(before)


@pytest.mark.parametrize("driver", ["maria", "jordan", "taylor", "alex"])
def test_cheapest_option_wins_even_over_budget(base_url, driver):
    # A tight budget flags options as over budget, but never makes us recommend one that costs more.
    car = httpx.get(f"{base_url}/api/drivers/{driver}", timeout=30).json()
    car["finances"] = {"monthly_income": 2200, "monthly_bills": 1500, "source": "manual"}
    plan = httpx.post(f"{base_url}/api/plan", json=car, timeout=60).json()["plan"]
    cheapest = min(plan["options"], key=lambda o: o["total_cost"])
    assert plan["recommended"] == cheapest["id"]


def test_every_tfs_service_is_listed_with_picks_marked(page: Page, base_url):
    open_plan(page, base_url, "taylor")
    catalog = page.locator("section[aria-labelledby=catalog]")
    expect(catalog.get_by_role("link")).to_have_count(15)
    marked = catalog.get_by_role("link").filter(has_text="For you")
    expect(marked.first).to_be_visible()
    assert marked.count() >= 4
    # Taylor buys out the lease, so the protection plans for keeping it are the picks
    expect(catalog.get_by_role("link", name=re.compile("Vehicle Service Agreement")).filter(has_text="For you")).to_be_visible()
    # rebates only apply to new Toyotas, so they must not be marked when the pick isn't a new one
    expect(catalog.get_by_role("link", name=re.compile("College Rebate")).filter(has_text="For you")).to_have_count(0)


def test_other_brand_sees_its_car_next_to_the_toyota(page: Page, base_url):
    open_plan(page, base_url, "jordan")
    compare = page.get_by_role("heading", name="Your CR-V vs. a RAV4 Hybrid")
    expect(compare).to_be_visible()
    expect(page.get_by_role("row", name=re.compile("Gas a year"))).to_be_visible()


def test_edit_details_keeps_what_you_entered(page: Page, base_url):
    open_plan(page, base_url, "sam")
    page.get_by_role("button", name="Edit your details").click()
    expect(page.get_by_role("heading", name="Edit your details")).to_be_visible()
    expect(page.get_by_label("Model", exact=True)).to_have_value("Corolla Hybrid")
    expect(page.get_by_label("Monthly take-home pay")).not_to_have_value("")
    page.get_by_label("Current mileage").fill("40000")
    page.get_by_role("button", name="See my next move").click()
    expect(page).to_have_url(re.compile(r"/plan$"))
    expect(page.get_by_text("Sam's 2024 Toyota Corolla Hybrid")).to_be_visible()


def test_recall_email_link_reopens_the_plan(page: Page, base_url):
    # The link packs the car and contract (no income) the same way the frontend does.
    car = httpx.get(f"{base_url}/api/drivers/sam", timeout=30).json()
    packed = base64.urlsafe_b64encode(json.dumps(
        {k: car[k] for k in ("path", "name", "vehicle", "contract", "miles_per_year")}).encode()).decode().rstrip("=")
    page.goto(f"{base_url}/plan?p={packed}")
    expect(page.get_by_text("Sam's 2024 Toyota Corolla Hybrid")).to_be_visible()
    expect(page.get_by_text("Your income isn’t saved in your link")).to_be_visible()
    expect(page.locator("#options article").first).to_be_visible()


def test_unknown_page_points_home(page: Page, base_url):
    page.goto(f"{base_url}/no-such-page")
    expect(page.get_by_role("heading", name="We can’t find that page")).to_be_visible()
    expect(page.get_by_role("link", name="Go to the home page")).to_have_attribute("href", "/")


# --- add your car ------------------------------------------------------------

def test_upload_toyota_loan_contract_to_plan(page: Page, base_url):
    page.goto(f"{base_url}/start?path=toyota")
    expect(page.get_by_text("We don’t save your file")).to_be_visible()
    page.set_input_files("input[type=file]", str(SAMPLES / "sample-loan-camry.pdf"))
    expect(page.get_by_text("We filled in what we found")).to_be_visible(timeout=60_000)
    expect(page.get_by_placeholder("Or enter your 17-character VIN")).to_have_value("4T1G11AK8RU417806")
    expect(page.get_by_label("Monthly payment")).to_have_value("676.64")
    expect(page.get_by_label("Interest rate (APR %)")).to_have_value("8.94")
    expect(page.locator("dl dt")).not_to_have_count(0)  # fine print explained in plain language
    page.get_by_label("Current mileage").fill("12500")
    page.get_by_label("Monthly take-home pay").fill("5800")
    page.get_by_label("Monthly bills (not counting your car)").fill("2300")
    page.get_by_role("button", name="See my next move").click()
    expect(page).to_have_url(re.compile(r"/plan$"))
    expect(page.get_by_text("2024 Toyota Camry").first).to_be_visible()
    expect(page.get_by_text("Protect yourself with GAP")).to_be_visible()  # $4,870 negative equity rolled in


def test_upload_other_brand_lease_compares_a_toyota(page: Page, base_url):
    page.goto(f"{base_url}/start?path=other")
    page.set_input_files("input[type=file]", str(SAMPLES / "sample-lease-honda-civic.pdf"))
    expect(page.get_by_text("We filled in what we found")).to_be_visible(timeout=60_000)
    expect(page.get_by_label("Buyout price at lease end")).to_have_value("15950")
    page.get_by_label("Current mileage").fill("31000")
    page.get_by_label("Monthly take-home pay").fill("5400")
    page.get_by_label("Monthly bills (not counting your car)").fill("2200")
    page.get_by_role("button", name="See my next move").click()
    expect(page.locator("#options")).to_contain_text("Corolla Hybrid")


def test_vin_lookup_fills_the_car(page: Page, base_url):
    page.goto(f"{base_url}/start?path=toyota")
    page.get_by_placeholder("Or enter your 17-character VIN").fill("2T3RWRFV4PW058213")
    page.get_by_role("button", name="Look up").click()
    expect(page.get_by_role("status")).to_contain_text("2023")
    expect(page.get_by_label("Model", exact=True)).to_have_value(re.compile("RAV4", re.I))


def test_bad_vin_explains_what_to_do(page: Page, base_url):
    page.goto(f"{base_url}/start?path=toyota")
    page.get_by_placeholder("Or enter your 17-character VIN").fill("12345")
    page.get_by_role("button", name="Look up").click()
    expect(page.get_by_role("status")).to_contain_text("17 characters")


def test_missing_mileage_is_caught_before_submitting(page: Page, base_url):
    page.goto(f"{base_url}/start?path=toyota")
    page.get_by_label("Year", exact=True).fill("2022")
    page.get_by_label("Model", exact=True).fill("RAV4")
    page.get_by_role("button", name="See my next move").click()
    # the field is marked, explained, focused, and listed next to the button
    mileage = page.get_by_label("Current mileage")
    expect(mileage).to_have_attribute("aria-invalid", "true")
    expect(mileage).to_be_focused()
    expect(page.get_by_role("alert").filter(has_text="to see your next move")).to_contain_text("Add your current mileage")
    expect(page).to_have_url(re.compile(r"/start"))
    mileage.fill("30000")
    expect(mileage).not_to_have_attribute("aria-invalid", "true")


def test_missing_income_is_caught_before_submitting(page: Page, base_url):
    page.goto(f"{base_url}/start?path=toyota")
    page.get_by_label("Year", exact=True).fill("2022")
    page.get_by_label("Model", exact=True).fill("RAV4")
    page.get_by_label("Current mileage").fill("30000")
    page.get_by_role("button", name="See my next move").click()
    expect(page.get_by_role("alert").filter(has_text="to see your next move")).to_contain_text("monthly income")
    expect(page.get_by_role("alert").filter(has_text="to see your next move")).to_contain_text("monthly payment")  # lease details are required too
    expect(page).to_have_url(re.compile(r"/start"))


def test_bank_connect_fills_budget(page: Page, base_url):
    page.goto(f"{base_url}/start?path=toyota")
    page.get_by_role("button", name=re.compile("Connect your bank")).click()
    expect(page.get_by_role("button", name="Bank connected")).to_be_visible()
    assert int(page.get_by_label("Monthly take-home pay").input_value()) > 0


# --- recall alerts -------------------------------------------------------------

def test_recall_alert_signup_sends_email(page: Page, base_url):
    open_plan(page, base_url, "maria")
    page.get_by_label("Email").fill(TEST_EMAIL)
    page.get_by_role("button", name="Turn on alerts").click()
    status = page.get_by_role("status").filter(has_text="Alerts are on")
    expect(status).to_contain_text("Check your inbox", timeout=30_000)


def test_unsubscribe_link_with_bad_token_is_friendly(page: Page, base_url):
    page.goto(f"{base_url}/api/alerts/unsubscribe?token=not-a-real-token")
    expect(page.get_by_text("already been used")).to_be_visible()


# --- layout and outbound links ---------------------------------------------------

@pytest.mark.parametrize("path", ["/", "/start?path=toyota", "/plan?driver=sam"])
def test_no_sideways_scrolling_on_a_phone(page: Page, base_url, path):
    page.set_viewport_size({"width": 375, "height": 800})
    page.goto(base_url + path)
    page.wait_for_load_state("networkidle")
    assert page.evaluate("document.documentElement.scrollWidth") <= 375


def test_every_tfs_link_works(base_url):
    products = httpx.get(f"{base_url}/api/tfs/products", timeout=30).json()
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh) Chrome/130 Safari/537.36"}
    for key, p in products.items():
        r = httpx.get(p["url"], headers=headers, follow_redirects=True, timeout=30)
        assert r.status_code == 200, f"{key}: {p['url']} returned {r.status_code}"


def test_every_integration_is_connected(base_url):
    status = httpx.get(f"{base_url}/api/status", timeout=30).json()
    for name in ("nessie", "serpapi", "gemini", "tiger", "nhtsa", "fueleconomy"):
        s = status[name]
        assert (s.get("configured") if isinstance(s, dict) else s), f"{name} is not configured"
