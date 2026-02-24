"""Persistent user financial profile store."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

PROFILE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "user_profile.json"

DEFAULT_PROFILE: dict[str, Any] = {
    "personal": {},
    "income": {},
    "expenses": {},
    "assets": {"accounts": []},
    "debts": [],
    "goals": [],
    "risk_tolerance": {},
    "investment_preferences": [],
    "notes": [],
}


def _load_profile() -> dict[str, Any]:
    """Load profile from disk, returning defaults if missing."""
    if PROFILE_PATH.exists():
        try:
            return json.loads(PROFILE_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            logger.warning("Failed to read user profile, using defaults")
    return {**DEFAULT_PROFILE}


def _save_profile(profile: dict[str, Any]) -> None:
    """Persist profile to disk."""
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(json.dumps(profile, indent=2))


def get_profile() -> dict[str, Any]:
    """Return the current user profile."""
    return _load_profile()


def update_profile(section: str, data: Any) -> dict[str, Any]:
    """Merge new data into a profile section.

    Args:
        section: Top-level key (e.g. 'personal', 'income', 'goals').
        data: Dict to merge (for dict sections) or list to replace (for list sections).

    Returns:
        The updated profile.
    """
    profile = _load_profile()

    existing = profile.get(section)
    if isinstance(existing, dict) and isinstance(data, dict):
        existing.update(data)
        profile[section] = existing
    elif isinstance(existing, list) and isinstance(data, list):
        profile[section] = data
    else:
        profile[section] = data

    _save_profile(profile)
    return profile


def add_note(note: str) -> None:
    """Append a timestamped note to the profile."""
    profile = _load_profile()
    profile.setdefault("notes", []).append({
        "content": note,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    _save_profile(profile)


def extract_profile_from_conversation(messages: list[dict[str, str]]) -> dict[str, Any]:
    """Use the LLM to extract financial profile data from a conversation.

    Args:
        messages: List of message dicts with 'role' and 'content' keys.

    Returns:
        The updated profile after extraction.
    """
    from litellm import completion as litellm_completion
    from app.services.llm import get_user_settings

    conversation = "\n".join(
        f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in messages
    )

    prompt = """Analyze this financial conversation and extract any concrete financial data mentioned by the user.

Return ONLY a JSON object. Only include fields where the user provided EXPLICIT numbers or facts. Do not guess.

{
  "personal": {"name": "...", "age": 0, "filing_status": "..."},
  "income": {"annual_salary": 0, "total_monthly": 0, "other_income": 0},
  "expenses": {"total_monthly": 0, "housing": 0, "credit_cards": 0, "misc": 0},
  "assets": {"accounts": [{"name": "...", "type": "...", "balance": 0}]},
  "debts": [{"type": "...", "balance": 0, "interest_rate": 0, "monthly_payment": 0}],
  "goals": [{"name": "...", "type": "...", "target_amount": 0}],
  "investment_preferences": ["..."]
}

Only include sections where you found real data. Omit empty sections entirely.

Conversation:
""" + conversation[:6000]

    settings = get_user_settings()
    provider = settings["provider"]
    if provider == "anthropic":
        model = f"anthropic/{settings['anthropic_model']}"
        api_key = settings["anthropic_api_key"]
    else:
        model = f"openai/{settings['openai_model']}"
        api_key = settings["openai_api_key"]

    try:
        response = litellm_completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            api_key=api_key,
            temperature=0.0,
            max_tokens=1500,
        )
        raw = response.choices[0].message.content
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start < 0 or end <= start:
            return get_profile()

        extracted = json.loads(raw[start:end])
        profile = _load_profile()

        for section, data in extracted.items():
            if section in ("personal", "income", "expenses") and isinstance(data, dict):
                filtered = {k: v for k, v in data.items() if v and v != 0}
                if filtered:
                    existing = profile.get(section, {})
                    if isinstance(existing, dict):
                        existing.update(filtered)
                        profile[section] = existing
                    else:
                        profile[section] = filtered
            elif section == "assets" and isinstance(data, dict):
                new_accounts = data.get("accounts", [])
                if new_accounts:
                    existing_accounts = profile.get("assets", {}).get("accounts", [])
                    existing_names = {a.get("name", "").lower() for a in existing_accounts}
                    for acc in new_accounts:
                        if acc.get("name", "").lower() not in existing_names and acc.get("balance", 0) > 0:
                            existing_accounts.append(acc)
                    profile.setdefault("assets", {})["accounts"] = existing_accounts
            elif section == "debts" and isinstance(data, list):
                existing_debts = profile.get("debts", [])
                existing_types = {d.get("type", "").lower() for d in existing_debts}
                for debt in data:
                    if debt.get("type", "").lower() not in existing_types and debt.get("balance", 0) > 0:
                        existing_debts.append(debt)
                profile["debts"] = existing_debts
            elif section == "goals" and isinstance(data, list):
                existing_goals = profile.get("goals", [])
                existing_names = {g.get("name", "").lower() for g in existing_goals}
                for goal in data:
                    if goal.get("name", "").lower() not in existing_names:
                        existing_goals.append(goal)
                profile["goals"] = existing_goals
            elif section == "investment_preferences" and isinstance(data, list):
                existing_prefs = set(profile.get("investment_preferences", []))
                existing_prefs.update(data)
                profile["investment_preferences"] = list(existing_prefs)

        _save_profile(profile)
        return profile

    except Exception:
        logger.exception("Profile extraction from conversation failed")
        return get_profile()


def _format_key(key: str) -> str:
    """Convert snake_case key to readable label."""
    return key.replace("_", " ").title()


def get_profile_summary() -> str:
    """Return a human-readable summary of the known profile information."""
    p = _load_profile()
    parts: list[str] = []

    personal = p.get("personal", {})
    if isinstance(personal, dict) and personal:
        bits = [f"{_format_key(k)}: {v}" for k, v in personal.items() if v]
        if bits:
            parts.append("Personal: " + ", ".join(bits))

    income = p.get("income", {})
    if isinstance(income, dict) and income:
        bits = []
        for k, v in income.items():
            if isinstance(v, (int, float)) and v > 0:
                bits.append(f"{_format_key(k)}: ${v:,.0f}")
        if bits:
            parts.append("Income: " + ", ".join(bits))

    expenses = p.get("expenses", {})
    if isinstance(expenses, dict) and expenses:
        bits = []
        for k, v in expenses.items():
            if isinstance(v, (int, float)) and v > 0:
                bits.append(f"{_format_key(k)}: ${v:,.0f}")
        if bits:
            parts.append("Expenses: " + ", ".join(bits))

    assets_section = p.get("assets", {})
    asset_lines: list[str] = []
    if isinstance(assets_section, dict):
        for k, v in assets_section.items():
            if k == "accounts":
                continue
            if isinstance(v, (int, float)) and v > 0:
                asset_lines.append(f"  - {_format_key(k)}: ${v:,.0f}")
        accounts = assets_section.get("accounts", [])
        if isinstance(accounts, list):
            for a in accounts:
                if isinstance(a, dict):
                    asset_lines.append(
                        f"  - {a.get('name', 'Account')}: ${a.get('balance', 0):,.0f} ({a.get('type', 'unknown')})"
                    )
    if asset_lines:
        parts.append("Assets:\n" + "\n".join(asset_lines))

    debts = p.get("debts", [])
    if isinstance(debts, list) and debts:
        debt_lines = [
            f"  - {d.get('type', 'Debt')}: ${d.get('balance', 0):,.0f} at {d.get('interest_rate', 0)}%"
            for d in debts if isinstance(d, dict)
        ]
        if debt_lines:
            parts.append("Debts:\n" + "\n".join(debt_lines))

    goals = p.get("goals", {})
    if isinstance(goals, list) and goals:
        goal_lines = [
            f"  - {g.get('name', 'Goal')}: ${g.get('target_amount', 0):,.0f} by {g.get('target_date', 'TBD')}"
            for g in goals if isinstance(g, dict)
        ]
        if goal_lines:
            parts.append("Goals:\n" + "\n".join(goal_lines))
    elif isinstance(goals, dict) and goals:
        goal_bits = [f"{_format_key(k)}: {v}" for k, v in goals.items() if v]
        if goal_bits:
            parts.append("Goals: " + ", ".join(goal_bits))

    risk = p.get("risk_tolerance", {})
    if isinstance(risk, dict) and risk.get("score"):
        parts.append(f"Risk tolerance: {risk['score']}/10 — {risk.get('description', '')}")

    prefs = p.get("investment_preferences", {})
    if isinstance(prefs, list) and prefs:
        parts.append("Investment preferences: " + ", ".join(str(x) for x in prefs))
    elif isinstance(prefs, dict) and prefs:
        pref_bits = []
        for k, v in prefs.items():
            if isinstance(v, dict):
                sub = ", ".join(
                    f"{sk}: ${sv}" if isinstance(sv, (int, float)) else f"{sk}: {sv}"
                    for sk, sv in v.items()
                )
                pref_bits.append(f"{_format_key(k)}: {sub}")
            else:
                pref_bits.append(f"{_format_key(k)}: {v}")
        parts.append("Investment preferences: " + "; ".join(pref_bits))

    if not parts:
        return "No financial profile information has been collected yet."

    return "\n\n".join(parts)
