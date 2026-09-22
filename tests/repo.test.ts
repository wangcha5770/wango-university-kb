import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "../src/db/client.js";
import {
  createUniversity,
  createAdmissionCategory,
  createProgram,
  createSource,
  createEvidence,
  createFact,
  verifyFact,
  supersedeFact,
  createConflict,
  resolveConflict,
  getFact,
  getFactHistory,
} from "../src/db/repo.js";

// Each test gets a fresh in-memory SQLite database — real SQLite (node:sqlite),
// just not persisted to disk, so tests are fast and fully isolated.
let db: DatabaseSync;
let admissionCategoryId: string;
let programId: string;

beforeEach(() => {
  db = openDb(":memory:");
  const u = createUniversity(db, { name: "Test University" });
  const ac = createAdmissionCategory(db, { universityId: u.id, name: "Test Admission Category", categoryType: "Direct-entry-program" });
  const p = createProgram(db, { universityId: u.id, primaryAdmissionCategoryId: ac.id, programName: "Test Program" });
  admissionCategoryId = ac.id;
  programId = p.id;
});

function makeSource(overrides: Partial<Parameters<typeof createSource>[1]> = {}) {
  return createSource(db, {
    title: "Test Official Source",
    url: "https://example.edu/test",
    sourceType: "UNIVERSITY_OFFICIAL",
    retrievedDate: "2026-09-21",
    sourceStatus: "CURRENT",
    sourceStatusReasoning: "Test fixture: explicitly reasoned, not defaulted.",
    ...overrides,
  });
}

function makeEvidence(sourceId: string, overrides: Partial<Parameters<typeof createEvidence>[1]> = {}) {
  return createEvidence(db, {
    sourceId,
    excerpt: "Verbatim test excerpt.",
    locator: "Test page — section heading",
    capturedDate: "2026-09-21",
    ...overrides,
  });
}

describe("1. Source creation", () => {
  it("creates a source with all provenance fields", () => {
    const s = makeSource();
    expect(s.id).toBeTruthy();
    expect(s.title).toBe("Test Official Source");
    expect(s.sourceStatus).toBe("CURRENT");
  });

  it("rejects a source with no status reasoning", () => {
    expect(() => makeSource({ sourceStatusReasoning: "" })).toThrow(/sourceStatusReasoning/);
  });
});

describe("2. Evidence creation", () => {
  it("creates evidence with excerpt, locator, source, captured date", () => {
    const s = makeSource();
    const e = makeEvidence(s.id);
    expect(e.excerpt).toBe("Verbatim test excerpt.");
    expect(e.locator).not.toBe("");
    expect(e.sourceId).toBe(s.id);
  });

  it("rejects evidence with an empty/placeholder locator", () => {
    const s = makeSource();
    expect(() => makeEvidence(s.id, { locator: "" })).toThrow(/locator/);
  });
});

describe("3. Fact creation", () => {
  it("creates a NEEDS_REVIEW fact from real evidence", () => {
    const s = makeSource();
    const e = makeEvidence(s.id);
    const f = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "application_deadline",
      value: "Jan 15",
      academicYear: "2027 Entry",
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e.id],
    });
    expect(f.verificationStatus).toBe("NEEDS_REVIEW");
    expect(f.evidenceIds).toEqual([e.id]);
  });

  it("rejects creating a fact directly as VERIFIED (only verifyFact can do that)", () => {
    const s = makeSource();
    const e = makeEvidence(s.id);
    expect(() =>
      createFact(db, {
        entityType: "PROGRAM",
        entityId: programId,
        fieldKey: "x",
        value: "x",
        academicYear: "2027",
        // @ts-expect-error - intentionally invalid at the type level too
        verificationStatus: "VERIFIED",
        extractedBy: "AI",
        evidenceIds: [e.id],
      })
    ).toThrow(/VERIFIED/);
  });
});

describe("4. Fact must have Evidence", () => {
  it("rejects a NEEDS_REVIEW fact with zero evidence", () => {
    expect(() =>
      createFact(db, {
        entityType: "PROGRAM",
        entityId: programId,
        fieldKey: "x",
        value: "x",
        academicYear: "2027",
        verificationStatus: "NEEDS_REVIEW",
        extractedBy: "AI",
        evidenceIds: [],
      })
    ).toThrow(/No Source, No Fact/);
  });

  it("rejects a fact referencing a nonexistent evidence id", () => {
    expect(() =>
      createFact(db, {
        entityType: "PROGRAM",
        entityId: programId,
        fieldKey: "x",
        value: "x",
        academicYear: "2027",
        verificationStatus: "NEEDS_REVIEW",
        extractedBy: "AI",
        evidenceIds: ["not-a-real-id"],
      })
    ).toThrow(/unknown Evidence/);
  });
});

describe("5. Evidence must have Source", () => {
  it("rejects evidence referencing a nonexistent source id", () => {
    expect(() => makeEvidence("not-a-real-source-id")).toThrow(/must have a Source/);
  });
});

describe("6. No Source -> NOT VERIFIED", () => {
  it("allows creating a fact with zero evidence only as NOT_VERIFIED", () => {
    const f = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "unknown_field",
      value: "NOT VERIFIED: nothing found",
      academicYear: "2027",
      verificationStatus: "NOT_VERIFIED",
      extractedBy: "AI",
      evidenceIds: [],
    });
    expect(f.verificationStatus).toBe("NOT_VERIFIED");
  });
});

describe("7. Academic Year", () => {
  it("rejects a fact with an empty academic year", () => {
    const s = makeSource();
    const e = makeEvidence(s.id);
    expect(() =>
      createFact(db, {
        entityType: "PROGRAM",
        entityId: programId,
        fieldKey: "x",
        value: "x",
        academicYear: "",
        verificationStatus: "NEEDS_REVIEW",
        extractedBy: "AI",
        evidenceIds: [e.id],
      })
    ).toThrow(/academicYear/);
  });
});

describe("8. Applicability / Scope", () => {
  it("defaults an unspecified applicant type to the explicit UNSPECIFIED marker, never silently 'all'", () => {
    const s = makeSource();
    const e = makeEvidence(s.id);
    const f = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "x",
      value: "x",
      academicYear: "2027",
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e.id],
    });
    expect(f.applicability.applicantType).toBe("UNSPECIFIED — confirm applicability");
  });

  it("preserves explicit applicability scoping", () => {
    const s = makeSource();
    const e = makeEvidence(s.id);
    const f = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "x",
      value: "x",
      academicYear: "2027",
      applicability: { applicantType: ["International"], province: null, campus: "Vancouver", admissionCategoryId, intake: "September" },
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e.id],
    });
    expect(f.applicability.applicantType).toEqual(["International"]);
    expect(f.applicability.campus).toBe("Vancouver");
  });
});

describe("9. Source Status", () => {
  it("accepts each of the four source statuses when reasoning is given", () => {
    for (const status of ["CURRENT", "POSSIBLY_OUTDATED", "SUPERSEDED", "UNKNOWN"] as const) {
      const s = makeSource({ sourceStatus: status, url: `https://example.edu/${status}` });
      expect(s.sourceStatus).toBe(status);
    }
  });
});

describe("10 & 11. Fact Verification / Human Review", () => {
  it("rejects AI as a reviewer identity", () => {
    const s = makeSource();
    const e = makeEvidence(s.id);
    const f = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "x",
      value: "x",
      academicYear: "2027",
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e.id],
    });
    expect(() => verifyFact(db, { factId: f.id, status: "VERIFIED", reviewedBy: "AI" })).toThrow(/human/);
  });

  it("lets a named human verify a fact and stamps last_verified_date + confirmed_by", () => {
    const s = makeSource();
    const e = makeEvidence(s.id);
    const f = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "x",
      value: "x",
      academicYear: "2027",
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e.id],
    });
    const result = verifyFact(db, { factId: f.id, status: "VERIFIED", reviewedBy: "Test Reviewer" });
    expect(result.fact.verificationStatus).toBe("VERIFIED");
    expect(result.fact.confirmedBy).toBe("Test Reviewer");
    expect(result.fact.lastVerifiedDate).toBeTruthy();
  });

  it("lets a human keep a fact at NEEDS_REVIEW or set it NOT_VERIFIED", () => {
    const s = makeSource();
    const e = makeEvidence(s.id);
    const f = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "x",
      value: "x",
      academicYear: "2027",
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e.id],
    });
    const kept = verifyFact(db, { factId: f.id, status: "NEEDS_REVIEW", reviewedBy: "Test Reviewer" });
    expect(kept.fact.verificationStatus).toBe("NEEDS_REVIEW");
    const rejected = verifyFact(db, { factId: f.id, status: "NOT_VERIFIED", reviewedBy: "Test Reviewer" });
    expect(rejected.fact.verificationStatus).toBe("NOT_VERIFIED");
  });

  it("blocks VERIFIED when the fact's only source is SUPERSEDED", () => {
    const s = makeSource({ sourceStatus: "SUPERSEDED", sourceStatusReasoning: "A newer page is known to exist." });
    const e = makeEvidence(s.id);
    const f = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "x",
      value: "x",
      academicYear: "2027",
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e.id],
    });
    expect(() => verifyFact(db, { factId: f.id, status: "VERIFIED", reviewedBy: "Test Reviewer" })).toThrow(/SUPERSEDED/);
  });

  it("warns (but allows) VERIFIED when the source is POSSIBLY_OUTDATED", () => {
    const s = makeSource({ sourceStatus: "POSSIBLY_OUTDATED", sourceStatusReasoning: "Older calendar edition." });
    const e = makeEvidence(s.id);
    const f = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "x",
      value: "x",
      academicYear: "2027",
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e.id],
    });
    const result = verifyFact(db, { factId: f.id, status: "VERIFIED", reviewedBy: "Test Reviewer" });
    expect(result.fact.verificationStatus).toBe("VERIFIED");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("12. Conflict", () => {
  function makeConflictingFacts() {
    const sA = makeSource({ url: "https://a.example.edu" });
    const sB = makeSource({ url: "https://b.example.edu" });
    const eA = makeEvidence(sA.id, { excerpt: "Version A" });
    const eB = makeEvidence(sB.id, { excerpt: "Version B" });
    const fA = createFact(db, { entityType: "PROGRAM", entityId: programId, fieldKey: "x", value: "A", academicYear: "2027", verificationStatus: "NEEDS_REVIEW", extractedBy: "AI", evidenceIds: [eA.id] });
    const fB = createFact(db, { entityType: "PROGRAM", entityId: programId, fieldKey: "x", value: "B", academicYear: "2027", verificationStatus: "NEEDS_REVIEW", extractedBy: "AI", evidenceIds: [eB.id] });
    return { sA, sB, fA, fB };
  }

  it("requires a SIMULATED label starting with SIMULATED when isSimulated is true", () => {
    const { sA, sB, fA, fB } = makeConflictingFacts();
    expect(() =>
      createConflict(db, {
        affectedFactIds: [fA.id, fB.id],
        sourceAId: sA.id,
        sourceBId: sB.id,
        conflictDescription: "test",
        detectedDate: "2026-09-21",
        isSimulated: true,
        simulatedLabel: "not properly labeled",
      })
    ).toThrow(/SIMULATED/);
  });

  it("marks affected facts CONFLICTING_SOURCES on creation", () => {
    const { sA, sB, fA, fB } = makeConflictingFacts();
    createConflict(db, {
      affectedFactIds: [fA.id, fB.id],
      sourceAId: sA.id,
      sourceBId: sB.id,
      conflictDescription: "Sources disagree.",
      detectedDate: "2026-09-21",
      isSimulated: false,
    });
    expect(getFact(db, fA.id)!.verificationStatus).toBe("CONFLICTING_SOURCES");
    expect(getFact(db, fB.id)!.verificationStatus).toBe("CONFLICTING_SOURCES");
  });

  it("rejects AI as a conflict resolver", () => {
    const { sA, sB, fA, fB } = makeConflictingFacts();
    const c = createConflict(db, {
      affectedFactIds: [fA.id, fB.id],
      sourceAId: sA.id,
      sourceBId: sB.id,
      conflictDescription: "Sources disagree.",
      detectedDate: "2026-09-21",
      isSimulated: false,
    });
    expect(() =>
      resolveConflict(db, { conflictId: c.id, resolvedBy: "AI", resolutionStatus: "RESOLVED_VERIFIED", resolutionNotes: "auto", winningFactId: fA.id })
    ).toThrow(/human/);
  });

  it("lets a human resolve a conflict to VERIFIED for the winning fact and NOT_VERIFIED for the other", () => {
    const { sA, sB, fA, fB } = makeConflictingFacts();
    const c = createConflict(db, {
      affectedFactIds: [fA.id, fB.id],
      sourceAId: sA.id,
      sourceBId: sB.id,
      conflictDescription: "Sources disagree.",
      detectedDate: "2026-09-21",
      isSimulated: false,
    });
    const resolved = resolveConflict(db, {
      conflictId: c.id,
      resolvedBy: "Test Reviewer",
      resolutionStatus: "RESOLVED_VERIFIED",
      resolutionNotes: "Confirmed A is correct after checking the primary source.",
      winningFactId: fA.id,
    });
    expect(resolved.resolutionStatus).toBe("RESOLVED_VERIFIED");
    expect(getFact(db, fA.id)!.verificationStatus).toBe("VERIFIED");
    expect(getFact(db, fB.id)!.verificationStatus).toBe("NOT_VERIFIED");
  });

  it("lets a human resolve a conflict as still-conflicting, leaving both facts CONFLICTING_SOURCES", () => {
    const { sA, sB, fA, fB } = makeConflictingFacts();
    const c = createConflict(db, {
      affectedFactIds: [fA.id, fB.id],
      sourceAId: sA.id,
      sourceBId: sB.id,
      conflictDescription: "Sources disagree.",
      detectedDate: "2026-09-21",
      isSimulated: false,
    });
    resolveConflict(db, { conflictId: c.id, resolvedBy: "Test Reviewer", resolutionStatus: "RESOLVED_STILL_CONFLICTING", resolutionNotes: "Genuinely ambiguous; keeping both on record." });
    expect(getFact(db, fA.id)!.verificationStatus).toBe("CONFLICTING_SOURCES");
    expect(getFact(db, fB.id)!.verificationStatus).toBe("CONFLICTING_SOURCES");
  });
});

describe("13 & 14. Append-only Fact + superseded_by_fact_id", () => {
  it("never overwrites a fact's value; supersede creates a new row and links old -> new", () => {
    const s = makeSource();
    const e1 = makeEvidence(s.id, { excerpt: "2026-27 value" });
    const original = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "application_deadline",
      value: "January 15, 2026",
      academicYear: "2026 Entry",
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e1.id],
    });

    const e2 = makeEvidence(s.id, { excerpt: "2027-28 value" });
    const updated = supersedeFact(db, {
      oldFactId: original.id,
      newValue: "January 15, 2027",
      newAcademicYear: "2027 Entry",
      newVerificationStatus: "NEEDS_REVIEW",
      newEvidenceIds: [e2.id],
      extractedBy: "AI",
    });

    // Old fact is untouched except for the supersededByFactId pointer.
    const oldReloaded = getFact(db, original.id)!;
    expect(oldReloaded.value).toBe("January 15, 2026");
    expect(oldReloaded.academicYear).toBe("2026 Entry");
    expect(oldReloaded.supersededByFactId).toBe(updated.id);

    // New fact is a distinct row.
    expect(updated.id).not.toBe(original.id);
    expect(updated.value).toBe("January 15, 2027");

    const history = getFactHistory(db, updated.id);
    expect(history.map((f) => f.value)).toEqual(["January 15, 2026", "January 15, 2027"]);
  });

  it("refuses to supersede a fact that is already superseded", () => {
    const s = makeSource();
    const e1 = makeEvidence(s.id);
    const original = createFact(db, {
      entityType: "PROGRAM",
      entityId: programId,
      fieldKey: "x",
      value: "v1",
      academicYear: "2026",
      verificationStatus: "NEEDS_REVIEW",
      extractedBy: "AI",
      evidenceIds: [e1.id],
    });
    const e2 = makeEvidence(s.id);
    supersedeFact(db, { oldFactId: original.id, newValue: "v2", newAcademicYear: "2027", newVerificationStatus: "NEEDS_REVIEW", newEvidenceIds: [e2.id], extractedBy: "AI" });
    const e3 = makeEvidence(s.id);
    expect(() =>
      supersedeFact(db, { oldFactId: original.id, newValue: "v3", newAcademicYear: "2028", newVerificationStatus: "NEEDS_REVIEW", newEvidenceIds: [e3.id], extractedBy: "AI" })
    ).toThrow(/already superseded/);
  });
});
