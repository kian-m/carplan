"""Toyota Financial Services offerings CarPlan can recommend.
Descriptions follow toyotafinancial.com wording; links go to the matching TFS page.
"""

TFS = "https://www.toyotafinancial.com/us/en"

PRODUCTS: dict[str, dict] = {
    # End-of-lease roads (TFS "Your Options")
    "payoff_quote": {
        "name": "Purchase your current vehicle",
        "category": "End of lease",
        "description": "Get a payoff quote and keep the car you already know.",
        "url": f"{TFS}/end_of_lease_options/your_option.html",
    },
    "turn_in_new": {
        "name": "Turn in and get a new Toyota",
        "category": "End of lease",
        "description": "Get a newer version of your car, or try a different Toyota.",
        "url": f"{TFS}/end_of_lease_options/your_option.html",
    },
    # Financing
    "finance_new": {
        "name": "Finance a new Toyota",
        "category": "Financing",
        "description": "Own your car, with no mileage limits. Loans from 24 to 72 months.",
        "url": f"{TFS}/financing_options/buy_a_toyota.html",
    },
    "certified_used": {
        "name": "Toyota Certified Used Vehicle",
        "category": "Financing",
        "description": "Checked on 160 points, with a warranty and a year of 24-hour roadside help.",
        "url": f"{TFS}/financing_options/buy_a_toyota.html",
    },
    "prequalify": {
        "name": "Get prequalified",
        "category": "Financing",
        "description": "Find out if you're prequalified in just a few steps.",
        "url": f"{TFS}/planning_tools/apply_for_credit.html",
    },
    # Rebates
    "repeat_customer": {
        "name": "Repeat Customer benefits",
        "category": "Rebates",
        "description": "Savings for people who have leased or financed with TFS before.",
        "url": f"{TFS}/financing_options/buy_a_toyota.html",
    },
    "college_rebate": {
        "name": "College Rebate Program",
        "category": "Rebates",
        "description": "Money off for college students and recent grads.",
        "url": f"{TFS}/financing_options/buy_a_toyota.html",
    },
    "military_rebate": {
        "name": "Military Rebate",
        "category": "Rebates",
        "description": "Money off for people who serve or have served.",
        "url": f"{TFS}/financing_options/buy_a_toyota.html",
    },
    # Voluntary protection (optional, cancellable, not required to obtain credit)
    "gap": {
        "name": "Guaranteed Auto Protection (GAP)",
        "category": "Protection",
        "description": "If your car is totaled and you owe more than it's worth, GAP can pay the difference.",
        "url": f"{TFS}/vehicle_protection_plan/guaranteed_auto_protection.html",
    },
    "vsa": {
        "name": "Vehicle Service Agreement",
        "category": "Protection",
        "description": "Helps pay for repairs after your factory warranty ends.",
        "url": f"{TFS}/vehicle_protection_plan/vehicle_service_agreements.html",
    },
    "toyotacare_plus": {
        "name": "ToyotaCare Plus",
        "category": "Protection",
        "description": "Pay now for future service, big repairs and 24-hour roadside help.",
        "url": f"{TFS}/vehicle_protection_plan/prepaid_maintenance_plan.html",
    },
    "auto_care": {
        "name": "Toyota Auto Care",
        "category": "Protection",
        "description": "Pay now for regular service and roadside help, at today's prices.",
        "url": f"{TFS}/vehicle_protection_plan/prepaid_maintenance_plan.html",
    },
    "tire_wheel": {
        "name": "Tire & Wheel Protection",
        "category": "Protection",
        "description": "Pays to fix tires and wheels hurt by potholes, nails and other road hazards.",
        "url": f"{TFS}/vehicle_protection_plan/tire_wheel_protection.html",
    },
    "excess_wear": {
        "name": "Excess Wear & Use Protection",
        "category": "Protection",
        "description": "Helps you avoid wear and mileage charges when your lease ends. No claims, no deductible.",
        "url": f"{TFS}/vehicle_protection_plan/excess_wear_use_protection.html",
    },
    "insurance": {
        "name": "Toyota Insurance",
        "category": "Insurance",
        "description": "Car, home and renters insurance for Toyota drivers.",
        "url": f"{TFS}.html",
    },
}

# Button labels for each product, so a button always says where it goes.
CTA = {
    "payoff_quote": "Get a payoff quote",
    "turn_in_new": "See lease-end options",
    "finance_new": "See financing options",
    "certified_used": "Browse Certified Used",
    "prequalify": "Get prequalified with TFS",
    "repeat_customer": "See repeat customer savings",
    "college_rebate": "See the College Rebate",
    "military_rebate": "See the Military Rebate",
    "gap": "Explore GAP coverage",
    "vsa": "See service agreements",
    "toyotacare_plus": "See ToyotaCare Plus",
    "auto_care": "See Toyota Auto Care",
    "tire_wheel": "See Tire & Wheel Protection",
    "excess_wear": "See Excess Wear & Use",
    "insurance": "Get an insurance quote",
}

PROTECTION_DISCLOSURE = (
    "Protection plans are optional. You can cancel them, and you don't need one to get a loan."
)
