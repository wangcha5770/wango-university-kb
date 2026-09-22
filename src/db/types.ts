// Wango University Knowledge Base — First Vertical Slice
// Types mirror KNOWLEDGE_BASE_ARCHITECTURE.md Rev. 3, §6 (scoped to the slice's entities).

export type SourceType =
  | "UNIVERSITY_OFFICIAL"
  | "GOVERNMENT"
  | "REGULATORY_BODY"
  | "OFFICIAL_STATISTICS"
  | "ACADEMIC_RESEARCH"
  | "INDUSTRY_RELIABLE"
  | "THIRD_PARTY_SUPPLEMENTARY";

export type SourceStatus = "CURRENT" | "POSSIBLY_OUTDATED" | "SUPERSEDED" | "UNKNOWN";

export type VerificationStatus =
  | "VERIFIED"
  | "NEEDS_REVIEW"
  | "NOT_VERIFIED"
  | "CONFLICTING_SOURCES";

export type ExtractedBy = "AI" | "HUMAN";

export type ConflictResolutionStatus =
  | "OPEN"
  | "HUMAN_REVIEW"
  | "RESOLVED_VERIFIED"
  | "RESOLVED_STILL_CONFLICTING";

export type ApplicantType = "Domestic" | "International" | "Transfer" | "Other";

/**
 * Architecture §10 — a Fact must never look like it applies to everyone by default.
 * If the source doesn't specify, every field below is written as the literal string
 * "UNSPECIFIED — confirm applicability", never omitted and never assumed to mean "all".
 */
export interface Applicability {
  applicantType: ApplicantType[] | "UNSPECIFIED — confirm applicability";
  province: string | null;
  campus: string | null;
  admissionCategoryId: string | null;
  intake: string | null;
}

export interface ResearchSession {
  id: string;
  prompt: string;
  researchDate: string;
  sourcesFound: number;
  evidenceExtracted: number;
  factsExtracted: number;
  gaps: string[];
  conflictsDetected: number;
  reviewStatus: "PENDING_REVIEW" | "REVIEWED";
  createdAt: string;
}

export interface University {
  id: string;
  name: string;
  shortName: string | null;
  province: string | null;
  officialAdmissionsUrl: string | null;
}

export interface AdmissionCategory {
  id: string;
  universityId: string;
  name: string;
  categoryType: string;
  description: string | null;
}

export interface Program {
  id: string;
  universityId: string;
  primaryAdmissionCategoryId: string;
  programName: string;
  degreeType: string | null;
}

export interface Source {
  id: string;
  title: string;
  url: string;
  sourceType: SourceType;
  publisher: string | null;
  academicYear: string | null;
  publishedOrUpdatedDate: string | null;
  retrievedDate: string;
  sourceStatus: SourceStatus;
  /** Mandatory — §7.2 requires Source Status to be a reasoned assessment, not a default. */
  sourceStatusReasoning: string;
  notes: string | null;
  researchSessionId: string | null;
}

export interface Evidence {
  id: string;
  sourceId: string;
  excerpt: string;
  locator: string;
  capturedDate: string;
  notes: string | null;
}

export interface Conflict {
  id: string;
  affectedFactIds: string[];
  sourceAId: string;
  sourceBId: string;
  conflictDescription: string;
  detectedDate: string;
  resolutionStatus: ConflictResolutionStatus;
  resolutionNotes: string | null;
  resolvedBy: string | null;
  resolvedDate: string | null;
  isSimulated: boolean;
  simulatedLabel: string | null;
}

export type FactEntityType = "UNIVERSITY" | "ADMISSION_CATEGORY" | "PROGRAM";

export interface Fact {
  id: string;
  entityType: FactEntityType;
  entityId: string;
  fieldKey: string;
  value: string;
  academicYear: string;
  applicability: Applicability;
  verificationStatus: VerificationStatus;
  conflictId: string | null;
  lastVerifiedDate: string | null;
  extractedBy: ExtractedBy;
  confirmedBy: string | null;
  supersededByFactId: string | null;
  researchSessionId: string | null;
  evidenceIds: string[];
  createdAt: string;
  updatedAt: string;
}
