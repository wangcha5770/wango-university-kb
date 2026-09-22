/**
 * Research Session: "UBC Undergraduate Commerce (BCom) Admission — 2027"
 *
 * Second Vertical Slice — same University (UBC), a new AdmissionCategory and
 * Program (Direct Entry — Bachelor of Commerce, Sauder School of Business).
 * Chosen deliberately over Arts because BCom Direct Entry does NOT share
 * Engineering's AdmissionCategory: it has its own supplementary application
 * and its own deadline data, so this slice genuinely tests whether multiple
 * AdmissionCategory/Program entities coexist cleanly under one University.
 *
 * This is real research, not illustrative data. Every excerpt below was
 * retrieved from UBC Sauder's own official pages on 2026-09-21 (see each
 * Source's url). Nothing here is pre-verified: every Fact this script
 * creates is left at NEEDS_REVIEW or NOT_VERIFIED, except the two Facts
 * deliberately routed into a real (non-simulated) Conflict.
 *
 * IMPORTANT: this script never calls verifyFact() or resolveConflict(). Only
 * Wango, acting through the Browser UAT surface, can move a Fact to VERIFIED
 * or resolve a Conflict — that is enforced in src/db/repo.ts, not just as a
 * convention here.
 *
 * NOTABLE FINDING: while researching the deadline, this session found a real,
 * unforced disagreement between UBC Sauder's own pages (in fact, between two
 * sections of the SAME page) — see the Conflict created below. This was not
 * manufactured to demonstrate the Conflict entity; it is an honest byproduct
 * of doing the research the way the architecture requires (checking dates
 * against their own page context instead of trusting a single mention).
 */
import path from "node:path";
import { openDb } from "../db/client.js";
import {
  createAdmissionCategory,
  createConflict,
  createEvidence,
  createFact,
  createProgram,
  createResearchSession,
  createSource,
  listUniversities,
  recomputeResearchSessionCounts,
} from "../db/repo.js";

const RETRIEVED_DATE = "2026-09-21";

function main() {
  const dbPath = process.env.WANGO_KB_DB_PATH ?? path.join(process.cwd(), "data", "kb.sqlite");
  const db = openDb(dbPath);

  // ---------------------------------------------------------------------
  // Research Session
  // ---------------------------------------------------------------------
  const session = createResearchSession(db, {
    prompt: "UBC Undergraduate Commerce (BCom) Admission — 2027",
    researchDate: RETRIEVED_DATE,
    gaps: [
      "sauder.ubc.ca/programs/bachelors-degrees/bachelor-commerce/program-admission contains two different application-deadline statements on the SAME page (January 15, 2027 in its 'Important dates' table vs January 25, 2027, 11:59pm PST in its 'Step 2: Complete the online application' section). This is recorded as a real (non-simulated) Conflict below rather than silently picked one way — see the Conflict entity for the full reasoning.",
      "No fixed minimum grade/percentage/GPA is published for BCom Direct Entry applicants on the program-admission overview page; it links out to further pages without disclosing a number on the page itself. Not confirmed exhaustively across every linked sub-page.",
      "The bachelor-commerce overview page labels its Year 1 tuition figures '2026/27' — the same one-cycle-behind naming ambiguity found in Slice 1's UBC Academic Calendar source. No page yet confirms BCom Direct Entry requirements are explicitly published under a '2027/28'-labeled edition.",
      "Combined-degree pathways (e.g. Bachelor + Master of Management, Combined Major in Business and Computer Science) were not investigated in this session — only the standalone BCom Direct Entry pathway.",
      "English language proficiency was not re-researched for Commerce specifically: this script reuses the existing UNIVERSITY-level Fact from the Engineering research session (UBC's English Language Admission Standard applies university-wide, not per-faculty), rather than duplicating it.",
    ],
  });

  // ---------------------------------------------------------------------
  // Domain: reuse the existing University (UBC) from Slice 1 — do not
  // create a duplicate. New AdmissionCategory + Program only.
  // ---------------------------------------------------------------------
  const existingUbc = listUniversities(db).find((u) => u.shortName === "UBC");
  if (!existingUbc) {
    throw new Error(
      "Expected University 'UBC' to already exist from Slice 1 (seed-ubc-engineering.ts). Run that seed first."
    );
  }
  const ubc = existingUbc;

  const admissionCategory = createAdmissionCategory(db, {
    universityId: ubc.id,
    name: "Direct Entry — Bachelor of Commerce (BCom)",
    categoryType: "Direct-entry-program",
    description:
      "The path a Grade 12 (or equivalent) applicant applies through to enter UBC Sauder School of Business's Bachelor of Commerce directly from secondary school. Distinct from Engineering's AdmissionCategory: BCom Direct Entry has its own supplementary application (Personal Profile + BCom Video Interview) and is administered by Sauder, not the Faculty of Applied Science.",
  });

  const program = createProgram(db, {
    universityId: ubc.id,
    primaryAdmissionCategoryId: admissionCategory.id,
    programName: "Commerce",
    degreeType: "Bachelor of Commerce (BCom)",
  });

  // ---------------------------------------------------------------------
  // Sources — each with an explicit, non-default source_status reasoning.
  // ---------------------------------------------------------------------

  const sourceDirectEntry = createSource(db, {
    title: "UBC Sauder — Direct Entry (Bachelor of Commerce)",
    url: "https://www.sauder.ubc.ca/programs/bachelors-degrees/bachelor-commerce/admissions-finance/direct-entry",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "UBC Sauder School of Business",
    academicYear: "2027 Entry (Year 1, Direct Entry)",
    publishedOrUpdatedDate: null,
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "CURRENT",
    sourceStatusReasoning:
      "The page's own 'Important dates' table explicitly states 'Final application deadline: January 15, 2027' — self-labeled to the Sept-2027-entry cycle this research targets, not inferred by us. No last-modified metadata was captured for this specific page, so — same as Slice 1's 'how-to-apply' source — this alone would only justify UNKNOWN; it is marked CURRENT instead because the January 15, 2027 date is a specific, self-consistent statement of the exact target cycle rather than a generic 'apply now' claim. Not marked CURRENT merely because the domain is sauder.ubc.ca.",
    researchSessionId: session.id,
  });

  const sourceProgramAdmission = createSource(db, {
    title: "UBC Sauder — Program Admission (Bachelor of Commerce)",
    url: "https://www.sauder.ubc.ca/programs/bachelors-degrees/bachelor-commerce/program-admission",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "UBC Sauder School of Business",
    academicYear: null,
    publishedOrUpdatedDate: null,
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "CURRENT",
    sourceStatusReasoning:
      "Live, current Sauder page — no reason to believe it is stale or superseded (source_status concerns currency, not internal consistency). IMPORTANT CAVEAT captured here rather than hidden: this single page states TWO different application deadlines in two different sections — 'January 15, 2027' in its 'Important dates' table and 'January 25, 2027 at 11:59pm PST' in its 'Step 2: Complete the online application' section. That internal inconsistency is a data-quality problem, not a currency problem, so it is NOT encoded by downgrading this source's status — it is instead recorded explicitly as a real Conflict entity (see below), per architecture §11: AI must record disagreement, never silently pick a side.",
    researchSessionId: session.id,
  });

  const sourceOverview = createSource(db, {
    title: "UBC Sauder — Bachelor of Commerce (Program Overview)",
    url: "https://www.sauder.ubc.ca/programs/bachelors-degrees/bachelor-commerce",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "UBC Sauder School of Business",
    academicYear: null,
    publishedOrUpdatedDate: null,
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "CURRENT",
    sourceStatusReasoning:
      "States 'Final application deadline: January 15, 2027', matching the target cycle and corroborating sourceDirectEntry — marked CURRENT on that specific statement's own merit, the same standard applied throughout this project. Flag for the record, not affecting this status: the same page labels its Year 1 tuition figures '2026/27', echoing the one-cycle-behind calendar-naming ambiguity already documented in Slice 1 (Engineering). No Fact in this script is built from the tuition figures, so that ambiguity does not propagate into any Fact here — noted only as a research gap above.",
    researchSessionId: session.id,
  });

  // ---------------------------------------------------------------------
  // Evidence — verbatim excerpts with real, specific locators.
  // ---------------------------------------------------------------------

  const evDirectEntryDeadline = createEvidence(db, {
    sourceId: sourceDirectEntry.id,
    excerpt: "Final application deadline | January 15, 2027",
    locator:
      "sauder.ubc.ca/.../bachelor-commerce/admissions-finance/direct-entry — Important dates table, 'Final application deadline' row",
    capturedDate: RETRIEVED_DATE,
  });

  const evProgramAdmissionImportantDates = createEvidence(db, {
    sourceId: sourceProgramAdmission.id,
    excerpt: "Final application deadline | January 15, 2027",
    locator: "sauder.ubc.ca/.../bachelor-commerce/program-admission — 'Important dates' section, deadline table row",
    capturedDate: RETRIEVED_DATE,
  });

  const evOverviewDeadline = createEvidence(db, {
    sourceId: sourceOverview.id,
    excerpt: "Final application deadline: January 15, 2027",
    locator: "sauder.ubc.ca/programs/bachelors-degrees/bachelor-commerce — program overview page, admission deadline line",
    capturedDate: RETRIEVED_DATE,
  });

  const evProgramAdmissionStep2 = createEvidence(db, {
    sourceId: sourceProgramAdmission.id,
    excerpt: "The final application deadline is January 25, 2027 at 11:59pm PST.",
    locator:
      "sauder.ubc.ca/.../bachelor-commerce/program-admission — 'Step 2: Complete the online application' section",
    capturedDate: RETRIEVED_DATE,
  });

  const evMathRequirement = createEvidence(db, {
    sourceId: sourceDirectEntry.id,
    excerpt:
      "Senior Level Math required. Pre-Calculus 12 is mandatory (BC curriculum) — Foundations of Mathematics 12 and Calculus 12 are not accepted as substitutes. Secondary calculus is strongly recommended.",
    locator: "sauder.ubc.ca/.../bachelor-commerce/admissions-finance/direct-entry — Academic prerequisites section, Math subsection",
    capturedDate: RETRIEVED_DATE,
  });

  const evSupplementary = createEvidence(db, {
    sourceId: sourceDirectEntry.id,
    excerpt:
      "Applicants complete a Personal Profile — a mix of short written responses and video interviews — including a BCom Video Interview.",
    locator: "sauder.ubc.ca/.../bachelor-commerce/admissions-finance/direct-entry — Supplementary application section",
    capturedDate: RETRIEVED_DATE,
  });

  // ---------------------------------------------------------------------
  // Facts — all NEEDS_REVIEW or NOT_VERIFIED at creation. None are
  // pre-verified: only Wango, through Browser UAT, can move any of these
  // to VERIFIED, or resolve the Conflict below.
  // ---------------------------------------------------------------------

  const factDeadlineJan15 = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "application_deadline",
    value:
      "January 15, 2027 — application deadline for Direct Entry (Year 1) BCom admission, Sept 2027 entry. Corroborated by 3 separate pages (Direct Entry page, Program Admission page's own 'Important dates' table, and the BCom program overview page).",
    academicYear: "2027 Entry (Year 1, Direct Entry)",
    applicability: {
      campus: "Vancouver",
      admissionCategoryId: admissionCategory.id,
      intake: "September 2027",
    },
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [evDirectEntryDeadline.id, evProgramAdmissionImportantDates.id, evOverviewDeadline.id],
    researchSessionId: session.id,
  });

  const factDeadlineJan25 = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "application_deadline",
    value:
      "January 25, 2027 at 11:59pm PST — a DIFFERENT deadline for the same BCom Direct Entry application, stated in the same Program Admission page's own 'Step 2: Complete the online application' instructions. Disagrees with the '15' date found in the same page's own 'Important dates' table (and with two other pages) — see the Conflict this Fact is attached to.",
    academicYear: "2027 Entry (Year 1, Direct Entry)",
    applicability: {
      campus: "Vancouver",
      admissionCategoryId: admissionCategory.id,
      intake: "September 2027",
    },
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [evProgramAdmissionStep2.id],
    researchSessionId: session.id,
  });

  // Real, non-simulated Conflict — the two Facts above genuinely disagree in
  // UBC's own published pages. createConflict() automatically flips both
  // Facts to CONFLICTING_SOURCES; this script never resolves it — that is
  // reserved for a human reviewer via resolveConflict() (architecture §11).
  createConflict(db, {
    affectedFactIds: [factDeadlineJan15.id, factDeadlineJan25.id],
    sourceAId: sourceDirectEntry.id,
    sourceBId: sourceProgramAdmission.id,
    conflictDescription:
      "UBC Sauder publishes two different BCom Direct Entry application deadlines. The Direct Entry page (sourceA) and the Program Admission page's own 'Important dates' table both state January 15, 2027 — three independent page-locations agree on '15'. However, the SAME Program Admission page (sourceB) also states, in its 'Step 2: Complete the online application' instructions, that 'the final application deadline is January 25, 2027 at 11:59pm PST'. This is most likely a stale sentence in Sauder's own Step 2 copy that was not updated when the Important Dates table was — but this project does not get to assume that; it is recorded as an open Conflict for a human to check directly with UBC Sauder (e.g. by contacting admissions, or watching for the page to be corrected) rather than silently preferring the majority date.",
    detectedDate: RETRIEVED_DATE,
    isSimulated: false,
  });

  const factMathRequirement = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "required_high_school_courses",
    value:
      "Senior Level Math required; Pre-Calculus 12 is mandatory (BC curriculum) — Foundations of Mathematics 12 and Calculus 12 are explicitly NOT accepted as substitutes. Secondary calculus is strongly recommended but not stated as mandatory.",
    academicYear: "2027 Entry (Year 1, Direct Entry)",
    applicability: {
      applicantType: ["Domestic", "International"],
      province: "British Columbia (or equivalent curriculum)",
      campus: "Vancouver",
      admissionCategoryId: admissionCategory.id,
    },
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [evMathRequirement.id],
    researchSessionId: session.id,
  });

  const factSupplementaryApplication = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "supplementary_application",
    value:
      "Required for Direct Entry applicants: a Personal Profile (short written responses) plus a BCom Video Interview. This is a Sauder-specific supplementary step, separate from and in addition to UBC's general application.",
    academicYear: "2027 Entry (Year 1, Direct Entry)",
    applicability: {
      applicantType: ["Domestic", "International"],
      admissionCategoryId: admissionCategory.id,
    },
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [evSupplementary.id],
    researchSessionId: session.id,
  });

  // Deliberate gap: NOT_VERIFIED because no source states this — not because
  // we forgot to look. Mirrors the same honest gap found for Engineering.
  const factGradeRequirementDirectEntry = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "grade_requirement_direct_entry",
    value:
      "NOT VERIFIED: the Program Admission overview page does not disclose a fixed minimum grade, percentage, or GPA cutoff for Direct Entry (Year 1) applicants on the page itself — it only links out to further pages without stating a number on the page checked. No page reviewed in this session states a numeric minimum for Direct Entry (unlike the corresponding Engineering Fact, which at least found a stated minimum for TRANSFER applicants — no equivalent transfer-grade page was located for Commerce in this session either).",
    academicYear: "2027 Entry (Year 1, Direct Entry)",
    applicability: {
      applicantType: ["Domestic", "International"],
      admissionCategoryId: admissionCategory.id,
    },
    verificationStatus: "NOT_VERIFIED",
    extractedBy: "AI",
    evidenceIds: [], // No Source, No Fact — this absence-of-a-number is exactly why it's NOT_VERIFIED.
    researchSessionId: session.id,
  });

  recomputeResearchSessionCounts(db, session.id);

  console.log("Seed complete.");
  console.log(`University (reused): ${ubc.name} (${ubc.id})`);
  console.log(`AdmissionCategory: ${admissionCategory.name} (${admissionCategory.id})`);
  console.log(`Program: ${program.programName} (${program.id})`);
  console.log(`Research Session: ${session.id}`);
  console.log("Facts created:");
  for (const f of [factDeadlineJan15, factDeadlineJan25, factMathRequirement, factSupplementaryApplication, factGradeRequirementDirectEntry]) {
    console.log(`  - [${f.verificationStatus}] ${f.fieldKey}: ${f.id}`);
  }
  console.log("REAL (non-simulated) Conflict created between factDeadlineJan15 and factDeadlineJan25 — both now CONFLICTING_SOURCES.");
}

main();
