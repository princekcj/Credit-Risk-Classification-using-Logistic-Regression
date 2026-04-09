"""
Factors, tips, plain-English explanations, and rule-based AI responses.
"""

from __future__ import annotations


# ── helpers ──────────────────────────────────────────────────────────────────────

def _dti(income: float, expenses: float) -> float:
    """Debt-to-income ratio (expenses / income)."""
    if income <= 0:
        return 1.0
    return min(expenses / income, 1.0)


def _savings_ratio(income: float, savings: float) -> float:
    if income <= 0:
        return 0.0
    return min(savings / income, 1.0)


# ── factors ──────────────────────────────────────────────────────────────────────

def get_factors(inp: dict, derived: dict | None = None) -> list[dict]:
    income              = float(inp.get("income", 0))
    expenses            = float(inp.get("expenses", 0))
    rent_consistency    = float(inp.get("rent_consistency", 0))
    mobile_transactions = int(inp.get("mobile_transactions", 0))
    savings             = float(inp.get("savings", 0))
    employment_type     = inp.get("employment_type", "employed")

    factors = []
    dti = _dti(income, expenses)

    # debt-to-income
    if dti < 0.35:
        factors.append({"name": "Low debt-to-income ratio", "impact": "+"})
    elif dti > 0.55:
        factors.append({"name": "High debt-to-income ratio", "impact": "-"})

    # rent consistency
    if rent_consistency >= 0.9:
        factors.append({"name": "Consistent rent/utility payments", "impact": "+"})
    elif rent_consistency < 0.6:
        factors.append({"name": "Irregular rent/utility payments", "impact": "-"})

    # mobile transactions
    if mobile_transactions >= 20:
        factors.append({"name": "Active mobile money usage", "impact": "+"})
    elif mobile_transactions < 5:
        factors.append({"name": "Low mobile money activity", "impact": "-"})

    # savings
    sr = _savings_ratio(income, savings)
    if sr >= 0.15:
        factors.append({"name": "Healthy savings buffer", "impact": "+"})
    elif sr < 0.05:
        factors.append({"name": "Minimal savings", "impact": "-"})

    # employment
    if employment_type == "employed":
        factors.append({"name": "Stable employment", "impact": "+"})
    elif employment_type in ("unemployed", "student"):
        factors.append({"name": "No current employment income", "impact": "-"})

    # income level
    if income >= 3000:
        factors.append({"name": "Strong monthly income", "impact": "+"})
    elif income < 800:
        factors.append({"name": "Low monthly income", "impact": "-"})

    return factors[:6]


# ── tips ─────────────────────────────────────────────────────────────────────────

def get_tips(inp: dict, derived: dict | None = None) -> list[str]:
    income              = float(inp.get("income", 0))
    expenses            = float(inp.get("expenses", 0))
    rent_consistency    = float(inp.get("rent_consistency", 0))
    mobile_transactions = int(inp.get("mobile_transactions", 0))
    savings             = float(inp.get("savings", 0))
    employment_type     = inp.get("employment_type", "employed")

    tips = []
    dti  = _dti(income, expenses)
    sr   = _savings_ratio(income, savings)

    if dti > 0.45:
        tips.append(
            "Reduce your monthly expenses to below 45% of income — this is one of the strongest "
            "signals lenders look at."
        )
    if rent_consistency < 0.8:
        tips.append(
            "Set up automatic payments for rent and utilities so you never miss a due date. "
            "Payment consistency is heavily weighted in your score."
        )
    if sr < 0.1:
        tips.append(
            "Build up your savings buffer to at least 10% of monthly income. Even small, "
            "regular deposits make a big difference."
        )
    if mobile_transactions < 10:
        tips.append(
            "Use MoMo or mobile banking more regularly — lenders use transaction frequency as "
            "a proxy for financial activity."
        )
    if employment_type in ("unemployed", "student"):
        tips.append(
            "If you have any freelance, trading, or informal income, record it consistently — "
            "it can strengthen your profile."
        )
    if income < 1500:
        tips.append(
            "Consider supplementing your income with a side hustle or additional work. "
            "Higher income broadens your credit options."
        )

    if not tips:
        tips.append(
            "You have a strong financial profile! Keep maintaining your current habits "
            "and consider diversifying your savings."
        )

    return tips


# ── explanation ──────────────────────────────────────────────────────────────────

def get_explanation(inp: dict, score: int, band: str, risk: dict) -> str:
    income           = float(inp.get("income", 0))
    expenses         = float(inp.get("expenses", 0))
    rent_consistency = float(inp.get("rent_consistency", 0))
    savings          = float(inp.get("savings", 0))
    employment_type  = inp.get("employment_type", "employed")

    dti = _dti(income, expenses)
    sr  = _savings_ratio(income, savings)

    lines = [
        f"Your ClearScore credit score is **{score}**, which places you in the **{band}** band.",
        "",
    ]

    if band == "Excellent":
        lines.append(
            "This is a top-tier score. You demonstrate low debt relative to income, "
            "consistent payment behaviour, and a solid savings cushion."
        )
    elif band == "Good":
        lines.append(
            "This is a good score. You show responsible financial habits overall, "
            "though there are specific areas where targeted improvements could push you higher."
        )
    elif band == "Fair":
        lines.append(
            "Your score is fair. You have some positive signals, but one or more key factors "
            "are holding your score back. The tips below can help you move into the Good range."
        )
    else:
        lines.append(
            "Your score is in the Poor range, which means lenders see higher risk. "
            "This is common for people new to formal finance. The good news is that consistent "
            "improvements can raise your score meaningfully within months."
        )

    lines.append("")

    # specific observations
    if dti > 0.5:
        lines.append(
            f"Your expenses (₵{expenses:,.0f}/mo) are {dti * 100:.0f}% of your income — "
            "reducing this ratio is the single most impactful thing you can do."
        )
    if rent_consistency < 0.7:
        lines.append(
            "Irregular payment history for rent or utilities is a significant negative signal."
        )
    if sr >= 0.15:
        lines.append(
            f"Your savings of ₵{savings:,.0f} represent a healthy buffer — this is a positive sign."
        )
    if employment_type == "employed":
        lines.append("Stable employment contributes positively to your profile.")

    return " ".join(lines)


# ── AI chat responses ─────────────────────────────────────────────────────────────

def get_ai_response(
    message: str,
    inp: dict,
    score: int,
    factors: list[dict],
    risk: dict,
) -> str:
    msg = message.lower().strip()

    income           = float(inp.get("income", 0))
    expenses         = float(inp.get("expenses", 0))
    savings          = float(inp.get("savings", 0))
    rent_consistency = float(inp.get("rent_consistency", 0))
    mobile_txns      = int(inp.get("mobile_transactions", 0))
    employment_type  = inp.get("employment_type", "employed")
    dti              = _dti(income, expenses)

    pos = [f["name"] for f in factors if f["impact"] == "+"]
    neg = [f["name"] for f in factors if f["impact"] == "-"]

    # ── routing ──────────────────────────────────────────────────────────────────
    if any(kw in msg for kw in ("why", "reason", "explain", "what", "score")):
        if neg:
            neg_list = "; ".join(neg)
            return (
                f"Your score of {score} is mainly being pulled down by: {neg_list}. "
                f"Addressing these areas would give you the biggest lift. "
                f"{'Your positives include: ' + '; '.join(pos) + '.' if pos else ''}"
            )
        return (
            f"Your score of {score} reflects a strong financial profile. "
            f"Your main strengths are: {'; '.join(pos) if pos else 'consistent habits across the board'}."
        )

    if any(kw in msg for kw in ("improve", "increase", "raise", "better", "higher", "boost", "how")):
        tips = get_tips(inp)
        return (
            "Here are the most impactful steps you can take:\n\n"
            + "\n".join(f"• {t}" for t in tips[:3])
        )

    if any(kw in msg for kw in ("loan", "credit", "borrow", "qualify")):
        if score >= 740:
            return (
                f"With a score of {score} (Excellent), you're in a strong position for most "
                "microfinance and mobile-lending products in Ghana."
            )
        elif score >= 670:
            return (
                f"With a score of {score} (Good), you should qualify for most standard loan "
                "products. Some premium rates may require a slightly higher score."
            )
        elif score >= 580:
            return (
                f"Your score of {score} (Fair) means some lenders may offer conditional credit "
                "or require a guarantor. Improving your score to 670+ will unlock better terms."
            )
        else:
            return (
                f"A score of {score} (Poor) makes formal credit difficult to access right now. "
                "Focus on consistent payments and building savings over 3–6 months, then re-check."
            )

    if any(kw in msg for kw in ("savings", "save", "money")):
        sr = _savings_ratio(income, savings)
        if sr >= 0.15:
            return (
                f"Your current savings of ₵{savings:,.0f} relative to income is solid. "
                "Maintaining or growing this buffer will continue to benefit your score."
            )
        return (
            f"Your savings buffer is currently low. Aim to save at least 10–15% of your monthly "
            f"income (₵{income * 0.1:,.0f}–₵{income * 0.15:,.0f}). "
            "Even small monthly deposits add up quickly."
        )

    if any(kw in msg for kw in ("expense", "spend", "spending", "budget")):
        if dti > 0.5:
            return (
                f"Your expense-to-income ratio is {dti * 100:.0f}%, which is high. "
                "Try to bring this below 45% by cutting non-essential costs. "
                f"That means targeting monthly expenses of ₵{income * 0.45:,.0f} or less."
            )
        return (
            f"Your expenses are {dti * 100:.0f}% of your income — that's within a healthy range. "
            "Keep monitoring and avoid lifestyle inflation as your income grows."
        )

    if any(kw in msg for kw in ("rent", "payment", "consistent", "miss")):
        if rent_consistency >= 0.9:
            return (
                "Your rent/utility payment consistency is excellent. Keep it up — "
                "this is one of the most trusted signals in alternative credit scoring."
            )
        return (
            f"Your payment consistency score is {rent_consistency * 100:.0f}%. "
            "Set up standing orders or reminders to ensure you never miss a due date. "
            "Getting this above 90% can meaningfully lift your score."
        )

    if any(kw in msg for kw in ("momo", "mobile", "transaction")):
        if mobile_txns >= 15:
            return (
                f"You have {mobile_txns} mobile transactions — that's a strong signal of "
                "financial activity and engagement."
            )
        return (
            f"You currently have {mobile_txns} mobile transactions recorded. "
            "Using MoMo or mobile banking for at least 15–20 transactions per month "
            "gives lenders more data to assess your financial behaviour."
        )

    if any(kw in msg for kw in ("hello", "hi", "hey", "help")):
        return (
            f"Hello! I'm your ClearScore assistant. Your current score is {score}. "
            "You can ask me: why is my score this? how can I improve it? will I qualify for a loan?"
        )

    # fallback
    return (
        f"Your credit score is {score}. I can help you understand why it's at this level, "
        "how to improve it, or whether you might qualify for a loan. What would you like to know?"
    )
