# Newsletter Composer Spec — The Retail Read

**Owner:** Neelabh Pant
**Platform:** nLab (personal automation tool)
**Version:** 1.0
**Status:** Locked for build
**Target:** Issue 1 ships by May 30, 2026

---

## 1. Purpose

The Newsletter Composer is the production engine for **The Retail Read**, a bi-weekly internal newsletter sent to retail-focused AEs, SEs, RVPs, and GVPs at Cloudera.

The composer turns Neelabh's research, opinions, and curated POVs into a polished newsletter in under 30 minutes per issue. AI assists each section. Neelabh edits. The output ships.

The composer is not an AI writer. It is an AI-assisted production tool. The voice belongs to Neelabh. The platform makes him faster.

---

## 2. Architecture Principles

### 2.1 Cloud-portable from day one

V1 runs locally. V2 will run on cloud (Vercel frontend + Railway/Render backend + Postgres + S3). The code must not block this migration.

**Rules:**
- All persistence goes through a `StorageBackend` interface
- V1 implements `LocalStorageBackend` (SQLite + filesystem)
- V2 will implement `CloudStorageBackend` (Postgres + S3)
- No feature code touches SQLite directly or reads from filesystem paths directly
- No hardcoded paths in feature logic
- No assumptions about single-user state outside the storage layer

### 2.2 Model selection

Global LLM provider/model lives in Settings (existing pattern).

Newsletter composer enforces **Claude Opus 4.7** for generation tasks. If Opus 4.7 isn't available, falls back to the global Anthropic model. If Anthropic isn't configured at all, surfaces a clear error in the UI.

Utility tasks (tagging, embedding, formatting) use the global setting.

```python
# backend/app/services/newsletter/model_config.py
GENERATION_MODEL = "claude-opus-4-7"
GENERATION_PROVIDER = "anthropic"
UTILITY_USES_GLOBAL = True
```

### 2.3 Settings model dropdown update

The current Anthropic model dropdown lists `claude-sonnet-4-6`. Update it to include the current model lineup:

- `claude-opus-4-7` (default for generation)
- `claude-opus-4-6`
- `claude-sonnet-4-6`
- `claude-haiku-4-5`

---

## 3. Storage Layer

### 3.1 Storage abstraction

```python
# backend/app/services/storage/base.py
from abc import ABC, abstractmethod
from typing import Any, Optional
from pathlib import Path

class StorageBackend(ABC):
    """Abstract storage backend. V1 = SQLite + filesystem. V2 = Postgres + S3."""

    @abstractmethod
    async def get(self, table: str, key: str) -> Optional[dict]:
        pass

    @abstractmethod
    async def put(self, table: str, key: str, value: dict) -> None:
        pass

    @abstractmethod
    async def delete(self, table: str, key: str) -> None:
        pass

    @abstractmethod
    async def list(self, table: str, prefix: Optional[str] = None) -> list[dict]:
        pass

    @abstractmethod
    async def store_file(self, path: str, data: bytes) -> str:
        """Returns the resolved location (filesystem path in v1, S3 URL in v2)."""
        pass

    @abstractmethod
    async def get_file(self, path: str) -> bytes:
        pass

    @abstractmethod
    async def file_url(self, path: str) -> str:
        """Returns a reference to the file (local path in v1, signed URL in v2)."""
        pass
```

### 3.2 SQLite tables (v1)

```sql
-- Newsletter content
CREATE TABLE newsletter_drafts (
  id TEXT PRIMARY KEY,
  issue_number INTEGER,
  status TEXT NOT NULL,  -- 'draft' | 'sent'
  content_json TEXT NOT NULL,  -- full issue content as JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE newsletter_issues (
  id TEXT PRIMARY KEY,
  issue_number INTEGER UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- e.g. "2026-05-issue-001"
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  pdf_path TEXT,
  html_path TEXT,
  sent_at TEXT NOT NULL,
  recipient_count INTEGER
);

-- POV Library
CREATE TABLE pov_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  one_liner TEXT,
  problem_statement TEXT,
  architecture TEXT,
  why_cloudera TEXT,
  target_accounts TEXT,  -- JSON array
  target_persona TEXT,
  ae_hook TEXT,
  demo_screenshot_path TEXT,
  demo_link TEXT,
  tags TEXT,  -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Voice corpus (few-shot examples)
CREATE TABLE voice_examples (
  id TEXT PRIMARY KEY,
  section_type TEXT NOT NULL,  -- 'the_read' | 'whats_moving' | 'use_case_spotlight' | 'wins' | 'horizon'
  example_text TEXT NOT NULL,
  source TEXT,  -- where it came from
  notes TEXT,
  created_at TEXT NOT NULL
);

-- Distribution
CREATE TABLE distribution_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  recipients_json TEXT NOT NULL,  -- JSON array of {name, email, role}
  is_default INTEGER DEFAULT 0
);
```

### 3.3 File storage layout

```
{STORAGE_ROOT}/
├── issues/
│   └── 2026-05/
│       └── issue-001/
│           ├── issue-001.pdf
│           └── issue-001.html
├── pov_screenshots/
│   ├── nie-platform.png
│   ├── visual-intelligence.png
│   └── ...
└── voice_corpus/
    └── (raw text files of past writing)
```

In v1, `STORAGE_ROOT` is `backend/data/newsletter/`. In v2, this becomes an S3 bucket prefix.

---

## 4. Newsletter Structure

Every issue has exactly five sections, same order:

| # | Section | Length | Description |
|---|---------|--------|-------------|
| 1 | The Read | ~100 words | Neelabh's opinion. One sharp take on something moving in retail AI. |
| 2 | What's Moving | 4 bullets, 1 line each | Week's signal, filtered to account-relevance |
| 3 | Use Case Spotlight | ~200 words + 1 image | One POV from the library with account-fit framing |
| 4 | Wins & References | 3 bullets | Retail/CPG closes, expansions, references, awards |
| 5 | On the Horizon | 3 bullets | Time-bound: board sessions, conferences, content drops |

**Footer:** Single rotating CTA line. Different each issue.

**Header:** Issue number, date, "The Retail Read" branding.

---

## 5. Voice Tuning System

This is the most important part of the spec. Voice failure means the newsletter sounds like AI. The fix is layered.

### 5.1 Style rules (system prompt, every generation call)

```
You are writing for Neelabh Pant, Director of Global AI Industry Solutions for Retail at Cloudera. You are writing in his voice.

Voice rules — apply rigorously:

1. NO em-dashes (—). Anywhere. Ever. Use periods, commas, parentheses, or colons.
2. Vary sentence length. Short, then medium, then long. Rhythm matters.
3. No parallel lists in prose. Write naturally: "some things include x, y, and z" not bulleted runs.
4. Lead with the sharpest insight. Don't build up to it. State it. Then explain.
5. No hedging ("perhaps", "might consider", "could potentially"). State.
6. No bolded lead-ins or filler phrases ("Here's the thing", "The reality is").
7. Direct, confident, conversational. Like a senior practitioner talking to peers.
8. Concrete over abstract. Name the thing. Give the specific.
9. When making a prediction or claim, be specific enough to be quotable.
10. Close understated, not performative. No exclamation marks.

If you find yourself writing a phrase that sounds like a copywriter, rewrite it.
If you find yourself hedging, rewrite without the hedge.
If a sentence has a parallel list, restructure.
```

### 5.2 Voice corpus (few-shot examples, by section type)

Stored in `voice_examples` table. Pre-seeded with these examples extracted from Neelabh's published work:

**For "The Read" section:**

```
Example 1 (from Retail Today Magazine byline):
"Gartner research shows that 91% of retail IT leaders are prioritizing AI as the top technology to implement this year. Yet far fewer are seeing meaningful results from their investments. The gap between spending and returns comes down to one thing: data access."

Example 2 (from same byline):
"Agentic AI makes this worse. Agents that autonomously adjust pricing, reroute shipments, and trigger replenishment need complete, real-time data from across the business. Feed them conflicting inputs from siloed systems and they make conflicting decisions."

Example 3 (prediction from byline):
"By the end of 2026, the retailers who haven't unified their data will find themselves locked out of the agentic economy entirely."

Example 4 (from Analytics Unite closing):
"The AI ambition is there. The data foundation is not. 91% prioritize AI. 44% are blocked by their own infrastructure. Closing that gap is the central challenge of this moment."

Example 5 (from Analytics Unite framework):
"Three phases. In that order. The order matters."
```

**For "What's Moving" section (1-line summaries):**

```
Example 1: "Walmart expanded its computer vision pilot to 500 stores, which matters because shrink prevention is the wedge into Walmart's IoT data fabric and that's a conversation Alan should be having now."

Example 2: "Kroger's 84.51 added Snowflake to its tech stack last month, signaling the kind of vendor consolidation question we should expect to hear in every CPG conversation this quarter."
```

**For "Use Case Spotlight" section:**

```
Example: "New Item Evaluation is the platform any CPG buyer wishes they had three years ago. A supplier submits a product, agents evaluate visual similarity to existing assortment, cannibalization risk, market context, financial projection, and a final recommendation. The differentiator is multimodal CLIP embeddings on OpenSearch, which means the agents actually see the product, not just read its description. No supplier-buyer tool in retail does this. Pitch it to merchandising and category management at Walmart, Target, Kroger, Costco. The hook: their buyers are still making subjective calls on new SKUs. We give them a data-driven second opinion in under 30 seconds."
```

**For "Wins & References" section:**

```
Example: "Walmart expanded its CDP footprint into store operations data, opening the door for the workforce intelligence demo Alan and team have been pitching since SKO."
```

**For "On the Horizon" section:**

```
Example: "Retail Industry Board Session 3, May 28. NIE walkthrough and field intel from Analytics Unite. AEs covering retail and CPG accounts, on the invite."
```

### 5.3 Voice verification rubric (post-generation check)

After every generation, a second Claude call (cheaper model: Haiku is fine) runs this rubric:

```
Check the following text for voice violations. List every violation found. If none, respond "PASS".

1. Em-dashes present? (Any "—" character)
2. Parallel lists in prose? (Multiple "do x, do y, do z" structures)
3. Hedging language? ("perhaps", "might", "could potentially")
4. Filler phrases? ("Here's the thing", "The reality is", "It's important to note")
5. Bolded lead-ins or excessive headers?
6. Exclamation marks?
7. Sentences over 30 words that don't earn their length?
8. Generic phrases that sound like a copywriter wrote them?

For each violation, suggest a rewrite.

Text to check:
[INSERTED HERE]
```

If violations are found, the composer offers to auto-fix with a single click. The user always gets the choice.

### 5.4 Voice corpus evolution

Every time Neelabh edits a draft and the issue ships, the final published version of each section is automatically added to `voice_examples` table with a flag `from_published_issue=true`. The system prompt prioritizes published examples over seed examples by Issue 3.

This means the voice gets sharper with every issue, automatically. By Issue 10, the model is generating in Neelabh's voice from his own corpus, not from seeded examples.

---

## 6. POV Library

### 6.1 Schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | UUID |
| name | string | yes | e.g. "New Item Evaluation Platform" |
| one_liner | string | yes | Single sentence positioning |
| problem_statement | text | yes | The problem this POV solves |
| architecture | text | yes | Architecture sketch (text format like "POS → NiFi → Kafka → Iceberg") |
| why_cloudera | text | yes | Competitive differentiation |
| target_accounts | array | yes | List of account names this fits |
| target_persona | string | yes | Buyer profile, e.g. "CPG merchandising, category management" |
| ae_hook | text | yes | "Use this when..." for the AE |
| demo_screenshot_path | string | no | File path to image |
| demo_link | text | no | URL to demo, repo, or video |
| tags | array | yes | Search/filter tags |
| created_at | string | yes | ISO timestamp |
| updated_at | string | yes | ISO timestamp |

### 6.2 Seed data (v1 ships with these)

Six POVs hand-curated, pre-loaded:

1. **New Item Evaluation Platform**
2. **Retail Visual Intelligence Platform**
3. **Customer 360 AI Personalization**
4. **Retail Demand Intelligence Command Center**
5. **Mars/Kellanova Innovation Engine**
6. **Workforce Intelligence (20-Agent CrewAI)**

Each pre-loaded with full content. See `pov_library_seed.json` (delivered as part of Phase 3 build).

### 6.3 Access boundaries

POV Library is **internal to nLab, internal to Neelabh**. It is not exposed to AEs directly.

POVs reach AEs through the newsletter. One POV per issue. Editorial curation by Neelabh.

---

## 7. Composer Workflow

### 7.1 Navigation

The Retail space reorganizes around four primary surfaces:

```
RETAIL
├── COMPOSE
│   ├── New Issue            ← The Retail Read composer
│   ├── Drafts               ← in-progress issues
│   └── Archive              ← sent issues
│
├── RESEARCH                 ← consolidates Daily Digest + Article Feed
│   ├── Daily Digest
│   └── Article Feed
│
├── LIBRARY                  ← new
│   ├── POVs
│   ├── Voice Examples
│   └── Distribution Lists
│
└── CHAT                     ← Retail Chat (unchanged)
```

CONFIGURATION (Sources) moves under a global Settings area.

### 7.2 Composer UI structure

Two-pane layout:

**Left pane (60% width): Section-by-section editor**
- Tabs or stepped flow for each of the 5 sections
- Each section has its own editor + AI assist controls
- "Preview Issue" button at top

**Right pane (40% width): Assistant panel**
- Context-aware: changes based on which section is active
- Shows article candidates, POV picker, voice examples, etc.
- Action buttons: "Draft this section", "Polish in voice", "Check voice", "Regenerate"

### 7.3 Section editors

Each section gets a tailored editor. Below is the spec per section.

---

### Section 1: The Read

**Input from Neelabh:**
- Topic seed (1-3 sentences of what he wants to write about)
- OR: Pick an article from this week's digest as the angle
- OR: Pick from "Suggested angles" — AI scans week's articles and proposes 3-5 angle prompts

**AI assists:**
- "Draft this section" → generates 100-word draft using voice rules + few-shot examples
- "Polish in voice" → takes Neelabh's rough version, rewrites in voice
- "Sharper" → makes the existing draft punchier (shortens sentences, removes hedging)
- "Make the prediction concrete" → if Neelabh's draft includes a prediction, makes it quotable and specific

**Constraints:**
- Hard word count cap: 130 words
- Hard rule: must contain at least one specific claim or prediction
- Voice check runs automatically before allowing save

---

### Section 2: What's Moving

**Input from Neelabh:**
- Pick 4 articles from this week's Daily Digest
- OR: AI suggests top 4 from this week based on relevance to NA retail accounts

**AI assists:**
- "Generate 1-line takes" → for each picked article, AI writes a 1-line summary in voice
- "Why it matters for [account]" → optional account-fit angle per article
- Neelabh can edit any of the 4 lines manually

**Constraints:**
- Exactly 4 items
- Each item: 1 line, 25 words max
- Must include account-relevance angle, not just news summary

---

### Section 3: Use Case Spotlight

**Input from Neelabh:**
- Pick one POV from the Library

**AI assists:**
- "Compose spotlight" → reads the POV record, generates 200-word spotlight with account-fit hook
- "Tailor for [account]" → optional, generates a version focused on a specific account
- Always pulls `demo_screenshot_path` for inclusion

**Constraints:**
- Hard word count cap: 230 words
- Must contain: what it is (1 sentence), differentiator (1 sentence), target accounts (1 sentence), AE hook (1 sentence)

---

### Section 4: Wins & References

**Input from Neelabh:**
- Free text area. Rough bullets. He pastes from his head or SFDC.

**Example raw input:**
```
- Walmart expanded CDP footprint
- Got CGT data leadership award
- Closed renewal with Kroger 84.51 last week
```

**AI assists:**
- "Polish in voice" → rewrites rough bullets into newsletter-quality wins
- Each bullet should: name the account/event, name what happened, signal why it matters

**Constraints:**
- Exactly 3 bullets
- Each bullet: 1-2 sentences max
- Voice check applies

---

### Section 5: On the Horizon

**Input from Neelabh:**
- Free text area. Rough bullets.

**AI assists:**
- "Polish in voice" → rewrites in voice
- "Add the ask" → suggests a CTA where appropriate (e.g. "AEs on Mars/Kellanova accounts, ping me before May 30")

**Constraints:**
- Exactly 3 bullets
- Each bullet: must be time-bound (date or window)
- Voice check applies

---

### 7.4 Composer state model

```typescript
type IssueDraft = {
  id: string;
  issueNumber: number;
  status: 'draft' | 'sent';
  sections: {
    theRead: { content: string; topicSeed?: string; angle?: string };
    whatsMoving: { items: Array<{ articleId: string; line: string }> };
    useCaseSpotlight: { povId: string; content: string; tailoredForAccount?: string };
    wins: { items: string[] };
    horizon: { items: string[] };
  };
  footerCTA: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
};
```

### 7.5 Auto-save

Composer auto-saves every 5 seconds while editing. Drafts persist across browser refreshes.

---

## 8. Export Formats

Every sent issue generates three artifacts:

### 8.1 PDF (archive format)

- Cloudera-branded template (use Cloudera orange, deep navy, clean sans-serif)
- Issue number and date in header
- "The Retail Read" wordmark
- Footer with Neelabh's name, title, and contact
- Embedded screenshots inline
- Used for: long-term archive, Highspot/Confluence upload

### 8.2 Email-ready HTML (primary send format)

- Single-column responsive HTML
- Inline CSS (email clients are picky)
- Cloudera color palette
- Each section visually separated
- Used for: paste into Gmail/Outlook compose window

### 8.3 Slack-formatted text (secondary distribution)

- Plain text with Slack markdown
- Bold section headers using `*asterisks*`
- Bullets using `•`
- Used for: pin in retail Slack channel

All three are generated in parallel when Neelabh hits "Send Issue."

---

## 9. Distribution Mechanics

### 9.1 Distribution lists

Stored in `distribution_lists` table. v1 ships with one list: "Retail NA Core" containing:
- AEs: Will Hartman, Anthony Larson, Alan Gooding, Brian McKay, Callen Fraychineaud, Joe McGowan
- RVPs: Ron Wood, Price Carlton
- GVPs: Eric Elam, Brad Hanggi
- (List editable in Library → Distribution Lists)

### 9.2 Send mechanism (v1)

V1 does **not** auto-send. Neelabh hits "Generate Issue" which produces all three artifacts. He copies the HTML output and pastes into his Outlook compose window.

V2 may add SMTP send or Outlook API integration, but it's out of scope for v1.

### 9.3 Archive

After hitting "Mark as Sent," the issue moves from `newsletter_drafts` to `newsletter_issues`. Permanent slug assigned. Visible in Compose → Archive.

---

## 10. AI Prompt Templates

Stored in `backend/app/services/newsletter/prompts/` as separate files for easy editing.

### 10.1 Generation prompt template (skeleton)

```
{VOICE_RULES_BLOCK}

You are drafting the [SECTION_NAME] section of The Retail Read, Issue [N].

Context:
- Target audience: Cloudera retail AEs, SEs, RVPs, GVPs
- Tone: senior practitioner talking to peers
- Goal: [SECTION-SPECIFIC GOAL]

Voice examples for this section type:
{FEW_SHOT_EXAMPLES_FROM_VOICE_CORPUS}

Constraints:
{SECTION_SPECIFIC_CONSTRAINTS}

Input from Neelabh:
{USER_INPUT}

Now write the section. Output only the section text. No commentary, no headers, no preamble.
```

### 10.2 Voice verification prompt

See section 5.3 above.

### 10.3 Polish-in-voice prompt

```
{VOICE_RULES_BLOCK}

Rewrite the following text in Neelabh's voice. Preserve the facts and claims. Change the language and rhythm.

Voice examples:
{FEW_SHOT_EXAMPLES}

Text to rewrite:
{USER_INPUT}

Output only the rewritten text.
```

---

## 11. File and Folder Layout (Backend)

```
backend/app/
├── routers/
│   └── newsletter.py              ← FastAPI endpoints
├── services/
│   ├── newsletter/
│   │   ├── __init__.py
│   │   ├── composer.py            ← orchestration
│   │   ├── sections.py            ← per-section logic
│   │   ├── voice.py               ← voice rules, verification
│   │   ├── exports.py             ← PDF, HTML, Slack
│   │   ├── model_config.py        ← Opus enforcement
│   │   └── prompts/
│   │       ├── voice_rules.txt
│   │       ├── the_read.txt
│   │       ├── whats_moving.txt
│   │       ├── use_case_spotlight.txt
│   │       ├── wins.txt
│   │       ├── horizon.txt
│   │       ├── polish.txt
│   │       └── voice_check.txt
│   ├── storage/
│   │   ├── __init__.py
│   │   ├── base.py                ← StorageBackend ABC
│   │   ├── local.py               ← LocalStorageBackend (SQLite + FS)
│   │   └── cloud.py               ← stub for v2
│   └── pov_library.py             ← POV CRUD service
├── models/
│   ├── newsletter.py              ← Pydantic models
│   ├── pov.py
│   └── voice.py
└── data/
    └── newsletter/
        ├── newsletter.db          ← SQLite
        ├── issues/
        ├── pov_screenshots/
        └── voice_corpus/
```

---

## 12. File and Folder Layout (Frontend)

```
frontend/src/spaces/retail/
├── compose/
│   ├── ComposePage.tsx
│   ├── ComposerLayout.tsx
│   ├── ArchivePage.tsx
│   ├── DraftsPage.tsx
│   ├── sections/
│   │   ├── TheReadEditor.tsx
│   │   ├── WhatsMovingEditor.tsx
│   │   ├── UseCaseSpotlightEditor.tsx
│   │   ├── WinsEditor.tsx
│   │   └── HorizonEditor.tsx
│   ├── AssistantPanel.tsx
│   ├── PreviewPane.tsx
│   └── stores/
│       └── compose-store.ts
├── research/
│   ├── DailyDigestPage.tsx       ← moved from old top-level
│   └── ArticleFeedPage.tsx       ← moved from old top-level
├── library/
│   ├── POVLibraryPage.tsx
│   ├── POVEditor.tsx
│   ├── VoiceExamplesPage.tsx
│   └── DistributionListsPage.tsx
├── chat/
│   └── RetailChatPage.tsx        ← existing
└── nav.ts                         ← updated navigation structure
```

---

## 13. Build Phases

Phase 1 — Spec lock. **DONE.**

Phase 2 — Navigation restructure. Move existing screens into new structure. Add Storage Abstraction Layer scaffold. Update Settings model dropdown. No new features.

Phase 3 — POV Library (CRUD + seed data with 6 POVs).

Phase 4 — Composer shell + state management + Compose/Drafts/Archive pages.

Phase 5 — Section editors with AI integration (5 editors, voice rules, voice verification).

Phase 6 — Export formats (PDF + HTML + Slack).

Phase 7 — Ship Issue 1 (use the tool for real).

Phase 8 — Visual polish via Claude Design.

Each phase delivers a working slice that can be tested in isolation.

---

## 14. Out of Scope for V1

- SFDC integration (wins are manual paste)
- Auto-email send (Neelabh pastes HTML into Outlook)
- Multi-user support
- Cloud deployment (designed-for, not built)
- Auto-LinkedIn external post
- Analytics on opens/clicks
- A/B testing of subject lines
- Calendar integration for scheduled sends
- Comment/feedback collection from readers

All of these are V2+ candidates. Don't build them now.

---

## 15. Success Criteria for V1

- Issue 1 of The Retail Read ships by May 30
- Total time per issue from open-to-send is under 30 minutes
- Voice quality is good enough that 8 of 10 sentences require no edits
- Three export formats are usable without manual reformatting
- POV Library has 6 hand-curated POVs ready to spotlight
- Daily Digest and Article Feed continue working as before (no regressions)
- Newsletter composer state survives browser refresh

---

End of spec.
