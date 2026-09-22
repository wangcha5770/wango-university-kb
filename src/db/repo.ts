import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type {
  Applicability,
  AdmissionCategory,
  Conflict,
  ConflictResolutionStatus,
  Evidence,
  Fact,
  FactEntityType,
  Program,
  ResearchSession,
  Source,
  SourceStatus,
  SourceType,
  University,
  VerificationStatus,
} from "./types.js";

// ---------------------------------------------------------------------------
// This file is the one place every invariant from KNOWLEDGE_BASE_ARCHITECTURE.md
// is actually enforced in code, not just described in prose. Every function
// below throws rather than silently allowing a schema violation.
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

function requireNonEmpty(value: string | undefined | null, fieldName: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} is required and cannot be empty.`);
  }
  return value;
}

const UNSPECIFIED = "UNSPECIFIED — confirm applicability" as const;

/** Architecture §10 — never let a Fact look like it applies to everyone by default. */
function normalizeApplicability(input: Partial<Applicability> | undefined): Applicability {
  return {
    applicantType: input?.applicantType && input.applicantType.length > 0 ? input.applicantType : UNSPECIFIED,
    province: input?.province ?? null,
    campus: input?.campus ?? null,
    admissionCategoryId: input?.admissionCategoryId ?? null,
    intake: input?.intake ?? null,
  };
}

// --------------------------- Domain entities --------------------------------

export function createUniversity(
  db: DatabaseSync,
  input: { name: string; shortName?: string | null; province?: string | null; officialAdmissionsUrl?: string | null }
): University {
  const id = randomUUID();
  requireNonEmpty(input.name, "University.name");
  db.prepare(
    `INSERT INTO university (id, name, short_name, province, official_admissions_url) VALUES (?, ?, ?, ?, ?)`
  ).run(id, input.name, input.shortName ?? null, input.province ?? null, input.officialAdmissionsUrl ?? null);
  return { id, name: input.name, shortName: input.shortName ?? null, province: input.province ?? null, officialAdmissionsUrl: input.officialAdmissionsUrl ?? null };
}

export function createAdmissionCategory(
  db: DatabaseSync,
  input: { universityId: string; name: string; categoryType: string; description?: string | null }
): AdmissionCategory {
  requireNonEmpty(input.universityId, "AdmissionCategory.universityId");
  requireNonEmpty(input.name, "AdmissionCategory.name");
  requireNonEmpty(input.categoryType, "AdmissionCategory.categoryType");
  if (!getUniversity(db, input.universityId)) {
    throw new Error(`AdmissionCategory references unknown University ${input.universityId}.`);
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO admission_category (id, university_id, name, category_type, description) VALUES (?, ?, ?, ?, ?)`
  ).run(id, input.universityId, input.name, input.categoryType, input.description ?? null);
  return { id, universityId: input.universityId, name: input.name, categoryType: input.categoryType, description: input.description ?? null };
}

export function createProgram(
  db: DatabaseSync,
  input: { universityId: string; primaryAdmissionCategoryId: string; programName: string; degreeType?: string | null }
): Program {
  requireNonEmpty(input.universityId, "Program.universityId");
  requireNonEmpty(input.primaryAdmissionCategoryId, "Program.primaryAdmissionCategoryId");
  requireNonEmpty(input.programName, "Program.programName");
  if (!getAdmissionCategory(db, input.primaryAdmissionCategoryId)) {
    throw new Error(`Program references unknown AdmissionCategory ${input.primaryAdmissionCategoryId}.`);
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO program (id, university_id, primary_admission_category_id, program_name, degree_type) VALUES (?, ?, ?, ?, ?)`
  ).run(id, input.universityId, input.primaryAdmissionCategoryId, input.programName, input.degreeType ?? null);
  return {
    id,
    universityId: input.universityId,
    primaryAdmissionCategoryId: input.primaryAdmissionCategoryId,
    programName: input.programName,
    degreeType: input.degreeType ?? null,
  };
}

// ----------------------------- Research Session ------------------------------

export function createResearchSession(
  db: DatabaseSync,
  input: { prompt: string; researchDate: string; gaps?: string[] }
): ResearchSession {
  requireNonEmpty(input.prompt, "ResearchSession.prompt");
  requireNonEmpty(input.researchDate, "ResearchSession.researchDate");
  const id = randomUUID();
  const createdAt = now();
  const gaps = input.gaps ?? [];
  db.prepare(
    `INSERT INTO research_session (id, prompt, research_date, sources_found, evidence_extracted, facts_extracted, gaps_json, conflicts_detected, review_status, created_at)
     VALUES (?, ?, ?, 0, 0, 0, ?, 0, 'PENDING_REVIEW', ?)`
  ).run(id, input.prompt, input.researchDate, JSON.stringify(gaps), createdAt);
  return {
    id,
    prompt: input.prompt,
    researchDate: input.researchDate,
    sourcesFound: 0,
    evidenceExtracted: 0,
    factsExtracted: 0,
    gaps,
    conflictsDetected: 0,
    reviewStatus: "PENDING_REVIEW",
    createdAt,
  };
}

/** Recomputes a Research Session's rollup counters from what's actually in the DB. */
export function recomputeResearchSessionCounts(db: DatabaseSync, sessionId: string): ResearchSession {
  const sourcesFound = (db.prepare(`SELECT COUNT(*) as c FROM source WHERE research_session_id = ?`).get(sessionId) as { c: number }).c;
  const evidenceExtracted = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM evidence e JOIN source s ON e.source_id = s.id WHERE s.research_session_id = ?`
      )
      .get(sessionId) as { c: number }
  ).c;
  const factsExtracted = (db.prepare(`SELECT COUNT(*) as c FROM fact WHERE research_session_id = ?`).get(sessionId) as { c: number }).c;
  const conflictsDetected = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT c.id) as c FROM conflict c WHERE c.source_a_id IN (SELECT id FROM source WHERE research_session_id = ?) OR c.source_b_id IN (SELECT id FROM source WHERE research_session_id = ?)`
      )
      .get(sessionId, sessionId) as { c: number }
  ).c;
  db.prepare(
    `UPDATE research_session SET sources_found = ?, evidence_extracted = ?, facts_extracted = ?, conflicts_detected = ? WHERE id = ?`
  ).run(sourcesFound, evidenceExtracted, factsExtracted, conflictsDetected, sessionId);
  return getResearchSession(db, sessionId)!;
}

export function markResearchSessionReviewed(db: DatabaseSync, sessionId: string): void {
  db.prepare(`UPDATE research_session SET review_status = 'REVIEWED' WHERE id = ?`).run(sessionId);
}

// -------------------------------- Source --------------------------------------

export function createSource(
  db: DatabaseSync,
  input: {
    title: string;
    url: string;
    sourceType: SourceType;
    publisher?: string | null;
    academicYear?: string | null;
    publishedOrUpdatedDate?: string | null;
    retrievedDate: string;
    sourceStatus: SourceStatus;
    /** Mandatory: §7.2 — a Source's status must be a reasoned assessment, never a bare default. */
    sourceStatusReasoning: string;
    notes?: string | null;
    researchSessionId?: string | null;
  }
): Source {
  requireNonEmpty(input.title, "Source.title");
  requireNonEmpty(input.url, "Source.url");
  requireNonEmpty(input.sourceType, "Source.sourceType");
  requireNonEmpty(input.retrievedDate, "Source.retrievedDate");
  requireNonEmpty(
    input.sourceStatusReasoning,
    "Source.sourceStatusReasoning (§7.2 — being ubc.ca does not make a source CURRENT by default; explain the assessment)"
  );
  const id = randomUUID();
  db.prepare(
    `INSERT INTO source (id, title, url, source_type, publisher, academic_year, published_or_updated_date, retrieved_date, source_status, source_status_reasoning, notes, research_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title,
    input.url,
    input.sourceType,
    input.publisher ?? null,
    input.academicYear ?? null,
    input.publishedOrUpdatedDate ?? null,
    input.retrievedDate,
    input.sourceStatus,
    input.sourceStatusReasoning,
    input.notes ?? null,
    input.researchSessionId ?? null
  );
  return getSource(db, id)!;
}

export function getSource(db: DatabaseSync, id: string): Source | null {
  const row = db.prepare(`SELECT * FROM source WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    title: row.title as string,
    url: row.url as string,
    sourceType: row.source_type as SourceType,
    publisher: (row.publisher as string) ?? null,
    academicYear: (row.academic_year as string) ?? null,
    publishedOrUpdatedDate: (row.published_or_updated_date as string) ?? null,
    retrievedDate: row.retrieved_date as string,
    sourceStatus: row.source_status as SourceStatus,
    sourceStatusReasoning: row.source_status_reasoning as string,
    notes: (row.notes as string) ?? null,
    researchSessionId: (row.research_session_id as string) ?? null,
  };
}

export function listSources(db: DatabaseSync): Source[] {
  const rows = db.prepare(`SELECT id FROM source ORDER BY rowid`).all() as { id: string }[];
  return rows.map((r) => getSource(db, r.id)!);
}

// -------------------------------- Evidence -------------------------------------

export function createEvidence(
  db: DatabaseSync,
  input: { sourceId: string; excerpt: string; locator: string; capturedDate: string; notes?: string | null }
): Evidence {
  requireNonEmpty(input.sourceId, "Evidence.sourceId");
  requireNonEmpty(input.excerpt, "Evidence.excerpt");
  requireNonEmpty(input.locator, "Evidence.locator (a bare 'UBC website' is not an acceptable locator)");
  requireNonEmpty(input.capturedDate, "Evidence.capturedDate");
  if (!getSource(db, input.sourceId)) {
    throw new Error(`Evidence must have a Source: no Source found with id ${input.sourceId}.`);
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO evidence (id, source_id, excerpt, locator, captured_date, notes) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.sourceId, input.excerpt, input.locator, input.capturedDate, input.notes ?? null);
  return { id, sourceId: input.sourceId, excerpt: input.excerpt, locator: input.locator, capturedDate: input.capturedDate, notes: input.notes ?? null };
}

export function getEvidence(db: DatabaseSync, id: string): Evidence | null {
  const row = db.prepare(`SELECT * FROM evidence WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    sourceId: row.source_id as string,
    excerpt: row.excerpt as string,
    locator: row.locator as string,
    capturedDate: row.captured_date as string,
    notes: (row.notes as string) ?? null,
  };
}

export function listEvidenceForSource(db: DatabaseSync, sourceId: string): Evidence[] {
  const rows = db.prepare(`SELECT id FROM evidence WHERE source_id = ? ORDER BY rowid`).all(sourceId) as { id: string }[];
  return rows.map((r) => getEvidence(db, r.id)!);
}

// ---------------------------------- Fact -----------------------------------------

/** The only statuses AI (or any non-human caller) may write when a Fact is first created. */
const CREATABLE_STATUSES: VerificationStatus[] = ["NEEDS_REVIEW", "NOT_VERIFIED", "CONFLICTING_SOURCES"];

export interface CreateFactInput {
  entityType: FactEntityType;
  entityId: string;
  fieldKey: string;
  value: string;
  academicYear: string;
  applicability?: Partial<Applicability>;
  verificationStatus: Extract<VerificationStatus, "NEEDS_REVIEW" | "NOT_VERIFIED" | "CONFLICTING_SOURCES">;
  extractedBy: "AI" | "HUMAN";
  evidenceIds: string[];
  researchSessionId?: string | null;
}

export function createFact(db: DatabaseSync, input: CreateFactInput): Fact {
  requireNonEmpty(input.entityType, "Fact.entityType");
  requireNonEmpty(input.entityId, "Fact.entityId");
  requireNonEmpty(input.fieldKey, "Fact.fieldKey");
  requireNonEmpty(input.value, "Fact.value");
  requireNonEmpty(input.academicYear, "Fact.academicYear (never inferred — architecture §6.3)");

  if (!CREATABLE_STATUSES.includes(input.verificationStatus)) {
    throw new Error(
      `Fact cannot be created with status '${input.verificationStatus}'. AI/creation may only produce NEEDS_REVIEW, NOT_VERIFIED, or CONFLICTING_SOURCES — VERIFIED is only reachable through verifyFact() by a human (architecture §9).`
    );
  }

  // "No Source, No Fact" (architecture §2.4) — enforced here, not just documented.
  if (input.evidenceIds.length === 0 && input.verificationStatus !== "NOT_VERIFIED") {
    throw new Error(
      `No Source, No Fact: a Fact with zero Evidence can only be created as NOT_VERIFIED, got '${input.verificationStatus}'.`
    );
  }
  for (const evidenceId of input.evidenceIds) {
    if (!getEvidence(db, evidenceId)) {
      throw new Error(`Fact references unknown Evidence ${evidenceId}.`);
    }
  }

  const applicability = normalizeApplicability(input.applicability);
  const id = randomUUID();
  const timestamp = now();

  db.prepare(
    `INSERT INTO fact (id, entity_type, entity_id, field_key, value, academic_year, applicability_json, verification_status, conflict_id, last_verified_date, extracted_by, confirmed_by, superseded_by_fact_id, research_session_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, ?, ?, ?)`
  ).run(
    id,
    input.entityType,
    input.entityId,
    input.fieldKey,
    input.value,
    input.academicYear,
    JSON.stringify(applicability),
    input.verificationStatus,
    input.extractedBy,
    input.researchSessionId ?? null,
    timestamp,
    timestamp
  );

  for (const evidenceId of input.evidenceIds) {
    db.prepare(`INSERT INTO fact_evidence (fact_id, evidence_id) VALUES (?, ?)`).run(id, evidenceId);
  }

  return getFact(db, id)!;
}

export function getFact(db: DatabaseSync, id: string): Fact | null {
  const row = db.prepare(`SELECT * FROM fact WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const evidenceRows = db.prepare(`SELECT evidence_id FROM fact_evidence WHERE fact_id = ?`).all(id) as { evidence_id: string }[];
  return {
    id: row.id as string,
    entityType: row.entity_type as FactEntityType,
    entityId: row.entity_id as string,
    fieldKey: row.field_key as string,
    value: row.value as string,
    academicYear: row.academic_year as string,
    applicability: JSON.parse(row.applicability_json as string) as Applicability,
    verificationStatus: row.verification_status as VerificationStatus,
    conflictId: (row.conflict_id as string) ?? null,
    lastVerifiedDate: (row.last_verified_date as string) ?? null,
    extractedBy: row.extracted_by as "AI" | "HUMAN",
    confirmedBy: (row.confirmed_by as string) ?? null,
    supersededByFactId: (row.superseded_by_fact_id as string) ?? null,
    researchSessionId: (row.research_session_id as string) ?? null,
    evidenceIds: evidenceRows.map((r) => r.evidence_id),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function listFactsForEntity(db: DatabaseSync, entityType: FactEntityType, entityId: string): Fact[] {
  const rows = db.prepare(`SELECT id FROM fact WHERE entity_type = ? AND entity_id = ? ORDER BY created_at`).all(entityType, entityId) as { id: string }[];
  return rows.map((r) => getFact(db, r.id)!);
}

/** Facts whose superseded_by_fact_id points at this fact — i.e. what it replaced. */
export function getFactPredecessors(db: DatabaseSync, factId: string): Fact[] {
  const rows = db.prepare(`SELECT id FROM fact WHERE superseded_by_fact_id = ?`).all(factId) as { id: string }[];
  return rows.map((r) => getFact(db, r.id)!);
}

/** Full append-only chain for a fact's field, oldest first, by walking backward then forward. */
export function getFactHistory(db: DatabaseSync, factId: string): Fact[] {
  let head = getFact(db, factId);
  if (!head) return [];
  // Walk to the oldest ancestor.
  while (true) {
    const predecessors = getFactPredecessors(db, head!.id);
    if (predecessors.length === 0) break;
    head = predecessors[0]!;
  }
  const chain: Fact[] = [];
  let current: Fact | null = head;
  while (current) {
    chain.push(current);
    current = current.supersededByFactId ? getFact(db, current.supersededByFactId) : null;
  }
  return chain;
}

const HUMAN_VERIFY_STATUSES: VerificationStatus[] = ["VERIFIED", "NEEDS_REVIEW", "NOT_VERIFIED"];
const RESERVED_NON_HUMAN_NAMES = ["ai", "system", "claude", "bot"];

function assertHumanReviewer(name: string, action: string): void {
  requireNonEmpty(name, `${action} requires a human reviewer name`);
  if (RESERVED_NON_HUMAN_NAMES.includes(name.trim().toLowerCase())) {
    throw new Error(`${action} must be performed by a human. '${name}' is a reserved non-human identity.`);
  }
}

export interface VerifyFactInput {
  factId: string;
  status: Extract<VerificationStatus, "VERIFIED" | "NEEDS_REVIEW" | "NOT_VERIFIED">;
  /** The human doing the review — e.g. "Wango". Required; AI cannot call this. */
  reviewedBy: string;
}

export interface VerifyFactResult {
  fact: Fact;
  warnings: string[];
}

/**
 * The ONLY function that can move a Fact to VERIFIED. Architecture §9: "AI never
 * self-promotes a Fact to VERIFIED." This function requires a named human reviewer
 * and, when verifying, checks every linked Source's status (§7.2).
 */
export function verifyFact(db: DatabaseSync, input: VerifyFactInput): VerifyFactResult {
  if (!HUMAN_VERIFY_STATUSES.includes(input.status)) {
    throw new Error(`verifyFact cannot set status '${input.status}'. Use resolveConflict for CONFLICTING_SOURCES.`);
  }
  assertHumanReviewer(input.reviewedBy, "verifyFact");

  const fact = getFact(db, input.factId);
  if (!fact) throw new Error(`Fact ${input.factId} not found.`);

  const warnings: string[] = [];

  if (input.status === "VERIFIED") {
    if (fact.evidenceIds.length === 0) {
      throw new Error(`No Source, No Fact: cannot VERIFY a Fact with no Evidence.`);
    }
    const sources = fact.evidenceIds
      .map((eid) => getEvidence(db, eid))
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => getSource(db, e.sourceId))
      .filter((s): s is NonNullable<typeof s> => s !== null);
    for (const source of sources) {
      if (source.sourceStatus === "SUPERSEDED") {
        throw new Error(
          `Cannot VERIFY: Source "${source.title}" (${source.id}) is marked SUPERSEDED (architecture §7.2 — Facts built from a superseded source must not be VERIFIED).`
        );
      }
      if (source.sourceStatus === "POSSIBLY_OUTDATED" || source.sourceStatus === "UNKNOWN") {
        warnings.push(
          `Source "${source.title}" is ${source.sourceStatus}. Verifying this Fact means you (${input.reviewedBy}) are personally attesting its currency, not just trusting the source's own metadata.`
        );
      }
    }
  }

  const timestamp = now();
  db.prepare(
    `UPDATE fact SET verification_status = ?, last_verified_date = ?, confirmed_by = ?, updated_at = ? WHERE id = ?`
  ).run(input.status, input.status === "NEEDS_REVIEW" ? null : timestamp, input.reviewedBy, timestamp, input.factId);

  return { fact: getFact(db, input.factId)!, warnings };
}

export interface SupersedeFactInput {
  oldFactId: string;
  newValue: string;
  newAcademicYear: string;
  newApplicability?: Partial<Applicability>;
  newVerificationStatus: Extract<VerificationStatus, "NEEDS_REVIEW" | "NOT_VERIFIED" | "CONFLICTING_SOURCES">;
  newEvidenceIds: string[];
  extractedBy: "AI" | "HUMAN";
  researchSessionId?: string | null;
}

/** Append-only update: creates a new Fact row and points the old one at it. Never overwrites. */
export function supersedeFact(db: DatabaseSync, input: SupersedeFactInput): Fact {
  const old = getFact(db, input.oldFactId);
  if (!old) throw new Error(`Fact ${input.oldFactId} not found.`);
  if (old.supersededByFactId) {
    throw new Error(`Fact ${input.oldFactId} is already superseded by ${old.supersededByFactId}; supersede the latest fact in the chain instead.`);
  }

  const newFact = createFact(db, {
    entityType: old.entityType,
    entityId: old.entityId,
    fieldKey: old.fieldKey,
    value: input.newValue,
    academicYear: input.newAcademicYear,
    applicability: input.newApplicability,
    verificationStatus: input.newVerificationStatus,
    extractedBy: input.extractedBy,
    evidenceIds: input.newEvidenceIds,
    researchSessionId: input.researchSessionId,
  });

  db.prepare(`UPDATE fact SET superseded_by_fact_id = ?, updated_at = ? WHERE id = ?`).run(newFact.id, now(), old.id);

  return newFact;
}

// -------------------------------- Conflict ---------------------------------------

export interface CreateConflictInput {
  affectedFactIds: string[];
  sourceAId: string;
  sourceBId: string;
  conflictDescription: string;
  detectedDate: string;
  isSimulated: boolean;
  /** Required when isSimulated is true; must literally start with "SIMULATED" (architecture §8). */
  simulatedLabel?: string;
}

export function createConflict(db: DatabaseSync, input: CreateConflictInput): Conflict {
  if (input.affectedFactIds.length === 0) {
    throw new Error("Conflict must reference at least one affected Fact.");
  }
  requireNonEmpty(input.sourceAId, "Conflict.sourceAId");
  requireNonEmpty(input.sourceBId, "Conflict.sourceBId");
  if (input.sourceAId === input.sourceBId) {
    throw new Error("Conflict requires two distinct sources.");
  }
  if (!getSource(db, input.sourceAId) || !getSource(db, input.sourceBId)) {
    throw new Error("Conflict references an unknown Source.");
  }
  requireNonEmpty(input.conflictDescription, "Conflict.conflictDescription");
  requireNonEmpty(input.detectedDate, "Conflict.detectedDate");
  for (const factId of input.affectedFactIds) {
    if (!getFact(db, factId)) throw new Error(`Conflict references unknown Fact ${factId}.`);
  }
  if (input.isSimulated) {
    if (!input.simulatedLabel || !input.simulatedLabel.toUpperCase().startsWith("SIMULATED")) {
      throw new Error(
        `A simulated Conflict must carry a simulatedLabel starting with "SIMULATED" (e.g. "SIMULATED — NOT REAL UBC CONFLICT"), so it can never be mistaken for a real one.`
      );
    }
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO conflict (id, affected_fact_ids_json, source_a_id, source_b_id, conflict_description, detected_date, resolution_status, resolution_notes, resolved_by, resolved_date, is_simulated, simulated_label)
     VALUES (?, ?, ?, ?, ?, ?, 'OPEN', NULL, NULL, NULL, ?, ?)`
  ).run(id, JSON.stringify(input.affectedFactIds), input.sourceAId, input.sourceBId, input.conflictDescription, input.detectedDate, input.isSimulated ? 1 : 0, input.simulatedLabel ?? null);

  for (const factId of input.affectedFactIds) {
    db.prepare(`UPDATE fact SET verification_status = 'CONFLICTING_SOURCES', conflict_id = ?, updated_at = ? WHERE id = ?`).run(id, now(), factId);
  }

  return getConflict(db, id)!;
}

export function getConflict(db: DatabaseSync, id: string): Conflict | null {
  const row = db.prepare(`SELECT * FROM conflict WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    affectedFactIds: JSON.parse(row.affected_fact_ids_json as string) as string[],
    sourceAId: row.source_a_id as string,
    sourceBId: row.source_b_id as string,
    conflictDescription: row.conflict_description as string,
    detectedDate: row.detected_date as string,
    resolutionStatus: row.resolution_status as ConflictResolutionStatus,
    resolutionNotes: (row.resolution_notes as string) ?? null,
    resolvedBy: (row.resolved_by as string) ?? null,
    resolvedDate: (row.resolved_date as string) ?? null,
    isSimulated: Boolean(row.is_simulated),
    simulatedLabel: (row.simulated_label as string) ?? null,
  };
}

export function listConflicts(db: DatabaseSync): Conflict[] {
  const rows = db.prepare(`SELECT id FROM conflict ORDER BY rowid`).all() as { id: string }[];
  return rows.map((r) => getConflict(db, r.id)!);
}

export interface ResolveConflictInput {
  conflictId: string;
  resolvedBy: string;
  resolutionStatus: Extract<ConflictResolutionStatus, "RESOLVED_VERIFIED" | "RESOLVED_STILL_CONFLICTING">;
  resolutionNotes: string;
  /** Required when resolutionStatus is RESOLVED_VERIFIED — which affected Fact is correct. */
  winningFactId?: string;
}

/** Only a human may resolve a Conflict; AI may create one but never resolve it (architecture §11). */
export function resolveConflict(db: DatabaseSync, input: ResolveConflictInput): Conflict {
  assertHumanReviewer(input.resolvedBy, "resolveConflict");
  requireNonEmpty(input.resolutionNotes, "resolveConflict.resolutionNotes");

  const conflict = getConflict(db, input.conflictId);
  if (!conflict) throw new Error(`Conflict ${input.conflictId} not found.`);
  if (conflict.resolutionStatus === "RESOLVED_VERIFIED" || conflict.resolutionStatus === "RESOLVED_STILL_CONFLICTING") {
    throw new Error(`Conflict ${input.conflictId} is already resolved.`);
  }

  if (input.resolutionStatus === "RESOLVED_VERIFIED") {
    if (!input.winningFactId || !conflict.affectedFactIds.includes(input.winningFactId)) {
      throw new Error("RESOLVED_VERIFIED requires winningFactId to be one of the Conflict's affected Facts.");
    }
    verifyFact(db, { factId: input.winningFactId, status: "VERIFIED", reviewedBy: input.resolvedBy });
    for (const factId of conflict.affectedFactIds) {
      if (factId !== input.winningFactId) {
        db.prepare(`UPDATE fact SET verification_status = 'NOT_VERIFIED', updated_at = ? WHERE id = ?`).run(now(), factId);
      }
    }
  }
  // RESOLVED_STILL_CONFLICTING: affected Facts deliberately stay CONFLICTING_SOURCES.

  db.prepare(
    `UPDATE conflict SET resolution_status = ?, resolution_notes = ?, resolved_by = ?, resolved_date = ? WHERE id = ?`
  ).run(input.resolutionStatus, input.resolutionNotes, input.resolvedBy, now(), input.conflictId);

  return getConflict(db, input.conflictId)!;
}

// -------------------------------- Lookups ---------------------------------------

export function getUniversity(db: DatabaseSync, id: string): University | null {
  const row = db.prepare(`SELECT * FROM university WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: row.id as string, name: row.name as string, shortName: (row.short_name as string) ?? null, province: (row.province as string) ?? null, officialAdmissionsUrl: (row.official_admissions_url as string) ?? null };
}

export function listUniversities(db: DatabaseSync): University[] {
  const rows = db.prepare(`SELECT id FROM university ORDER BY name`).all() as { id: string }[];
  return rows.map((r) => getUniversity(db, r.id)!);
}

export function getAdmissionCategory(db: DatabaseSync, id: string): AdmissionCategory | null {
  const row = db.prepare(`SELECT * FROM admission_category WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: row.id as string, universityId: row.university_id as string, name: row.name as string, categoryType: row.category_type as string, description: (row.description as string) ?? null };
}

export function listAdmissionCategoriesForUniversity(db: DatabaseSync, universityId: string): AdmissionCategory[] {
  const rows = db.prepare(`SELECT id FROM admission_category WHERE university_id = ? ORDER BY name`).all(universityId) as { id: string }[];
  return rows.map((r) => getAdmissionCategory(db, r.id)!);
}

export function getProgram(db: DatabaseSync, id: string): Program | null {
  const row = db.prepare(`SELECT * FROM program WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: row.id as string, universityId: row.university_id as string, primaryAdmissionCategoryId: row.primary_admission_category_id as string, programName: row.program_name as string, degreeType: (row.degree_type as string) ?? null };
}

export function listProgramsForAdmissionCategory(db: DatabaseSync, admissionCategoryId: string): Program[] {
  const rows = db.prepare(`SELECT id FROM program WHERE primary_admission_category_id = ? ORDER BY program_name`).all(admissionCategoryId) as { id: string }[];
  return rows.map((r) => getProgram(db, r.id)!);
}

export function getResearchSession(db: DatabaseSync, id: string): ResearchSession | null {
  const row = db.prepare(`SELECT * FROM research_session WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    prompt: row.prompt as string,
    researchDate: row.research_date as string,
    sourcesFound: row.sources_found as number,
    evidenceExtracted: row.evidence_extracted as number,
    factsExtracted: row.facts_extracted as number,
    gaps: JSON.parse(row.gaps_json as string) as string[],
    conflictsDetected: row.conflicts_detected as number,
    reviewStatus: row.review_status as "PENDING_REVIEW" | "REVIEWED",
    createdAt: row.created_at as string,
  };
}

export function listResearchSessions(db: DatabaseSync): ResearchSession[] {
  const rows = db.prepare(`SELECT id FROM research_session ORDER BY created_at DESC`).all() as { id: string }[];
  return rows.map((r) => getResearchSession(db, r.id)!);
}
