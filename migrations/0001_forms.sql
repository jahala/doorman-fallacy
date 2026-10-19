-- What the site's forms store. Times are ISO 8601 UTC text, so they sort as text.
-- An applied step is never edited; a change is a new step (docs/data-model.md#d1).

CREATE TABLE suggestions (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('case', 'error')),
  -- The case an error report is about; null for a suggested case.
  case_slug TEXT,
  -- A JSON array of one to five http or https URLs; empty for an error report with no link.
  links TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  -- Name and email are blanked 90 days after the suggestion is resolved.
  name TEXT,
  email TEXT,
  credit INTEGER NOT NULL DEFAULT 0 CHECK (credit IN (0, 1)),
  -- Set by the desk's triage.
  triage_label TEXT,
  -- Set by the desk when it has looked into the suggestion.
  resolved_at TEXT,
  CHECK (kind <> 'error' OR case_slug IS NOT NULL)
);

CREATE INDEX suggestions_resolved_at ON suggestions (resolved_at) WHERE resolved_at IS NOT NULL;

CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY,
  -- Lower case.
  email TEXT NOT NULL UNIQUE,
  -- 32 random bytes as 64 hex characters. Confirms the address, then unsubscribes it.
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  -- When the current token was emailed. An unconfirmed address is deleted 7 days after this.
  token_sent_at TEXT NOT NULL,
  confirmed_at TEXT
);

CREATE INDEX subscribers_unconfirmed ON subscribers (token_sent_at) WHERE confirmed_at IS NULL;

-- One row per accepted form submission, to hold the limit of 5 an hour for each kind of form.
CREATE TABLE rate_hits (
  id INTEGER PRIMARY KEY,
  -- SHA-256 of the form kind and the visitor's address, as hex. The address itself is not kept.
  key TEXT NOT NULL,
  hit_at TEXT NOT NULL
);

CREATE INDEX rate_hits_key_hit_at ON rate_hits (key, hit_at);
