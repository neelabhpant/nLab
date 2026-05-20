-- Newsletter Composer storage schema (v1, SQLite).
-- Spec: NEWSLETTER_COMPOSER_SPEC.md §3.2.
-- This DDL is idempotent and runs on first start when the database file does not yet exist.

CREATE TABLE IF NOT EXISTS newsletter_drafts (
  id TEXT PRIMARY KEY,
  issue_number INTEGER,
  status TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS newsletter_issues (
  id TEXT PRIMARY KEY,
  issue_number INTEGER UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  pdf_path TEXT,
  html_path TEXT,
  sent_at TEXT NOT NULL,
  recipient_count INTEGER
);

CREATE TABLE IF NOT EXISTS pov_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  one_liner TEXT,
  problem_statement TEXT,
  architecture TEXT,
  why_cloudera TEXT,
  target_accounts TEXT,
  target_persona TEXT,
  ae_hook TEXT,
  demo_screenshot_path TEXT,
  demo_link TEXT,
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS voice_examples (
  id TEXT PRIMARY KEY,
  section_type TEXT NOT NULL,
  example_text TEXT NOT NULL,
  source TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS distribution_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  recipients_json TEXT NOT NULL,
  is_default INTEGER DEFAULT 0
);
