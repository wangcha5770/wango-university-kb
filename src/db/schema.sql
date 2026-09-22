-- Wango University Knowledge Base — First Vertical Slice schema
-- Scope: University, AdmissionCategory, Program (domain) +
--        Source, Evidence, Fact, Conflict, ResearchSession (support)
-- Deliberately excludes Specialization/Career/Comparison/DecisionQuestion/WangoAnalysis —
-- those remain architecture-only for this slice (see KNOWLEDGE_BASE_ARCHITECTURE.md §21 row 13).

CREATE TABLE IF NOT EXISTS research_session (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  research_date TEXT NOT NULL,
  sources_found INTEGER NOT NULL DEFAULT 0,
  evidence_extracted INTEGER NOT NULL DEFAULT 0,
  facts_extracted INTEGER NOT NULL DEFAULT 0,
  gaps_json TEXT NOT NULL DEFAULT '[]',
  conflicts_detected INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS university (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  province TEXT,
  official_admissions_url TEXT
);

CREATE TABLE IF NOT EXISTS admission_category (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES university(id),
  name TEXT NOT NULL,
  category_type TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS program (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES university(id),
  primary_admission_category_id TEXT NOT NULL REFERENCES admission_category(id),
  program_name TEXT NOT NULL,
  degree_type TEXT
);

CREATE TABLE IF NOT EXISTS source (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  publisher TEXT,
  academic_year TEXT,
  published_or_updated_date TEXT,
  retrieved_date TEXT NOT NULL,
  source_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  source_status_reasoning TEXT NOT NULL,
  notes TEXT,
  research_session_id TEXT REFERENCES research_session(id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source(id),
  excerpt TEXT NOT NULL,
  locator TEXT NOT NULL,
  captured_date TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS conflict (
  id TEXT PRIMARY KEY,
  affected_fact_ids_json TEXT NOT NULL,
  source_a_id TEXT NOT NULL REFERENCES source(id),
  source_b_id TEXT NOT NULL REFERENCES source(id),
  conflict_description TEXT NOT NULL,
  detected_date TEXT NOT NULL,
  resolution_status TEXT NOT NULL DEFAULT 'OPEN',
  resolution_notes TEXT,
  resolved_by TEXT,
  resolved_date TEXT,
  is_simulated INTEGER NOT NULL DEFAULT 0,
  simulated_label TEXT
);

CREATE TABLE IF NOT EXISTS fact (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  applicability_json TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  conflict_id TEXT REFERENCES conflict(id),
  last_verified_date TEXT,
  extracted_by TEXT NOT NULL,
  confirmed_by TEXT,
  superseded_by_fact_id TEXT REFERENCES fact(id),
  research_session_id TEXT REFERENCES research_session(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_evidence (
  fact_id TEXT NOT NULL REFERENCES fact(id),
  evidence_id TEXT NOT NULL REFERENCES evidence(id),
  PRIMARY KEY (fact_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_fact_entity ON fact(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence(source_id);
CREATE INDEX IF NOT EXISTS idx_fact_evidence_fact ON fact_evidence(fact_id);
