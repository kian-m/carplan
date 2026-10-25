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
        "description": "Get a newer model of what you're already driving, or try a completely different Toyota.",
        "url": f"{TFS}/end_of_lease_options/your_option.html",
    },
    # Financing
    "finance_new": {
        "name": "Finance a new Toyota",
        "category": "Financing",
        "description": "The freedom of ownership: no mileage limits and no end-of-lease obligations. Terms from 24 to 72 months.",
        "url": f"{TFS}/financing_options/buy_a_toyota.html",
    },
    "certified_used": {
        "name": "Toyota Certified Used Vehicle",
        "category": "Financing",
        "description": "A 160-point Quality Assurance inspection, comprehensive warranties and a year of 24-hour Roadside Assistance, at standard new-car rates.",
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
        "description": "Special benefits for customers who have previously financed or leased through TFS.",
        "url": f"{TFS}/financing_options/buy_a_toyota.html",
    },
    "college_rebate": {
        "name": "College Rebate Program",
        "category": "Rebates",
        "description": "A special program for college students and recent grads.",
        "url": f"{TFS}/financing_options/buy_a_toyota.html",
    },
    "military_rebate": {
        "name": "Military Rebate",
        "category": "Rebates",
        "description": "You've served our country. Let us serve you.",
        "url": f"{TFS}/financing_options/buy_a_toyota.html",
    },
    # Voluntary protection (optional, cancellable, not required to obtain credit)
    "gap": {
        "name": "Guaranteed Auto Protection (GAP)",
        "category": "Protection",
        "description": "Helps cover certain expenses if your car is declared a total loss and you owe more than it's worth.",
        "url": f"{TFS}/vehicle_protection_plan/guaranteed_auto_protection.html",
    },
    "vsa": {
        "name": "Vehicle Service Agreement",
        "category": "Protection",
        "description": "Helps cover eligible repair costs due to mechanical failure outside your standard warranty.",
        "url": f"{TFS}/vehicle_protection_plan/vehicle_service_agreements.html",
    },
    "toyotacare_plus": {
        "name": "ToyotaCare Plus",
        "category": "Protection",
        "description": "Prepaid plan covering scheduled maintenance, major services and 24-hour Roadside Assistance.",
        "url": f"{TFS}/vehicle_protection_plan/prepaid_maintenance_plan.html",
    },
    "auto_care": {
        "name": "Toyota Auto Care",
        "category": "Protection",
        "description": "Prepaid maintenance covering regularly scheduled service and roadside assistance.",
        "url": f"{TFS}/vehicle_protection_plan/prepaid_maintenance_plan.html",
    },
    "tire_wheel": {
        "name": "Tire & Wheel Protection",
        "category": "Protection",
        "description": "Covers you if your tires or wheels are damaged by certain eligible road hazards.",
        "url": f"{TFS}/vehicle_protection_plan/tire_wheel_protection.html",
    },
    "excess_wear": {
        "name": "Excess Wear & Use Protection",
        "category": "Protection",
        "description": "Helps protect you from excess wear and use charges at lease-end, with no claims to submit and no deductibles.",
        "url": f"{TFS}/vehicle_protection_plan/excess_wear_use_protection.html",
    },
    "insurance": {
        "name": "Toyota Insurance",
        "category": "Insurance",
        "description": "Auto, home and renters insurance for Toyota owners.",
        "url": f"{TFS}.html",
    },
}

PROTECTION_DISCLOSURE = (
    "Protection products are optional, cancellable (see Terms of Agreement) and not required to obtain credit."
)
