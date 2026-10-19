-- What the desk's weekly run keeps in D1.

CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  outlet TEXT,
  published TEXT,
  found_at TEXT NOT NULL,
  triage_label TEXT,
  triage_reason TEXT,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'published', 'rejected'))
);

-- URLs already triaged, so they are not triaged twice.
CREATE TABLE seen (
  url TEXT PRIMARY KEY,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX seen_last_seen_at ON seen (last_seen_at);

CREATE TABLE runs (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  -- JSON object of counts: leads found, drafted, published and so on.
  counts TEXT NOT NULL DEFAULT '{}',
  -- JSON array of the failures the run reported.
  failures TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX runs_started_at ON runs (started_at);
