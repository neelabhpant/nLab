"""CrewAI tools for the financial advisor crew."""

import json
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field, field_validator

from app.services.documents import search_documents
from app.services.user_profile import (
    add_note,
    get_profile_summary,
    update_profile,
)


class SearchDocumentsInput(BaseModel):
    query: str = Field(
        ...,
        description="Natural language query to search uploaded financial documents, e.g. 'total income from tax return' or 'checking account balance'",
    )
    n_results: int = Field(
        5,
        description="Number of document chunks to return (1-10). Default 5.",
    )

    @field_validator("n_results", mode="before")
    @classmethod
    def coerce_n_results(cls, v: object) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 5


class SearchDocumentsTool(BaseTool):
    name: str = "search_documents"
    description: str = (
        "Search the user's uploaded financial documents (tax returns, bank statements, "
        "pay stubs, etc.) for relevant information. Returns the most relevant text "
        "chunks from their documents. Use this to find specific financial data points "
        "the user has shared through document uploads."
    )
    args_schema: Type[BaseModel] = SearchDocumentsInput

    def _run(self, query: str, n_results: int = 5) -> str:
        """Search documents and return formatted results."""
        results = search_documents(query, min(n_results, 10))
        if not results:
            return "No uploaded documents found. The user hasn't shared any financial documents yet."
        lines = []
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] From {r['filename']}:\n{r['content']}")
        return "\n\n".join(lines)


class GetUserProfileInput(BaseModel):
    placeholder: str = Field("", description="Not used — leave empty.")


class GetUserProfileTool(BaseTool):
    name: str = "get_user_profile"
    description: str = (
        "Get the user's current financial profile summary. This includes their "
        "personal info, income, expenses, assets, debts, goals, risk tolerance, "
        "and any notes from previous conversations. Always check the profile "
        "before giving personalised advice."
    )
    args_schema: Type[BaseModel] = GetUserProfileInput

    def _run(self, **kwargs: str) -> str:
        """Return the profile summary."""
        return get_profile_summary()


class UpdateUserProfileInput(BaseModel):
    section: str = Field(
        ...,
        description=(
            "Profile section to update. One of: 'personal', 'income', 'expenses', "
            "'assets', 'debts', 'goals', 'risk_tolerance', 'investment_preferences'"
        ),
    )
    data: str = Field(
        ...,
        description="JSON string of the data to merge into the section. For dict sections provide a JSON object, for list sections provide a JSON array.",
    )


class UpdateUserProfileTool(BaseTool):
    name: str = "update_user_profile"
    description: str = (
        "Update a section of the user's financial profile with new information. "
        "Use this when the user shares financial details in conversation or when "
        "document analysis reveals new information. Merges data into the existing "
        "profile rather than replacing it."
    )
    args_schema: Type[BaseModel] = UpdateUserProfileInput

    def _run(self, section: str, data: str) -> str:
        """Update profile section and confirm."""
        try:
            parsed = json.loads(data)
        except json.JSONDecodeError:
            return f"Error: Could not parse data as JSON: {data}"

        valid_sections = [
            "personal", "income", "expenses", "assets", "debts",
            "goals", "risk_tolerance", "investment_preferences",
        ]
        if section not in valid_sections:
            return f"Error: Invalid section '{section}'. Must be one of: {', '.join(valid_sections)}"

        update_profile(section, parsed)
        return f"Successfully updated '{section}' section of the user profile."


class AddProfileNoteInput(BaseModel):
    note: str = Field(
        ...,
        description="A note to save about the user's financial situation, preferences, or key discussion points from this conversation.",
    )


class AddProfileNoteTool(BaseTool):
    name: str = "add_profile_note"
    description: str = (
        "Add a timestamped note to the user's profile. Use this to record "
        "important observations, user preferences, key decisions made during "
        "the conversation, or action items. These notes persist across sessions "
        "to maintain continuity."
    )
    args_schema: Type[BaseModel] = AddProfileNoteInput

    def _run(self, note: str) -> str:
        """Add note and confirm."""
        add_note(note)
        return "Note saved to user profile."
