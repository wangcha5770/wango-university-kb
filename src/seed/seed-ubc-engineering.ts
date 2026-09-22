/**
 * Research Session: "UBC Undergraduate Engineering Admission — 2027"
 *
 * This is real research, not illustrative data. Every excerpt below was retrieved
 * from UBC's own official pages on 2026-09-21 (see each Source's url). Nothing here
 * is pre-verified: every Fact this script creates is left at NEEDS_REVIEW or
 * NOT_VERIFIED (or, for the deliberately isolated test fixture, CONFLICTING_SOURCES).
 *
 * IMPORTANT: this script never calls verifyFact(). Only Wango, acting through the
 * Browser UAT surface, can move a Fact to VERIFIED — that is enforced in
 * src/db/repo.ts, not just as a convention here. AI (this script) is not a human
 * reviewer, and verifyFact()/resolveConflict() reject "AI" as a reviewer name.
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
  createUniversity,
  recomputeResearchSessionCounts,
  supersedeFact,
} from "../db/repo.js";

const RETRIEVED_DATE = "2026-09-21";

function main() {
  const dbPath = process.env.WANGO_KB_DB_PATH ?? path.join(process.cwd(), "data", "kb.sqlite");
  const db = openDb(dbPath);

  // ---------------------------------------------------------------------
  // Research Session
  // ---------------------------------------------------------------------
  const session = createResearchSession(db, {
    prompt: "UBC Undergraduate Engineering Admission — 2027",
    researchDate: RETRIEVED_DATE,
    gaps: [
      "No fixed minimum grade/percentage is published for Engineering applicants entering directly from secondary school (admission is described only as 'competitive'). A numeric minimum exists only for post-secondary transfer applicants.",
      "engineering.ubc.ca/admissions/undergraduate/how-to-apply does not expose its own last-modified date, so its currency rests on content cross-check against you.ubc.ca's confirmed-current dates page, not on this page's own metadata.",
      "The English Language Proficiency Tests calendar page does not state which Academic Calendar edition (2025/26 vs 2026/27) it belongs to.",
      "No UBC page yet confirms Engineering's admission requirements specifically for the 2027/28 academic-calendar edition — UBC has not published a 2027/28 calendar edition as of retrieval, only 2026/27.",
      "Portfolio and interview requirements were not investigated in this session (Engineering direct-entry does not appear to require either, based on the pages read, but this was not exhaustively confirmed against every program variant).",
    ],
  });

  // ---------------------------------------------------------------------
  // Domain: University -> AdmissionCategory -> Program
  // ---------------------------------------------------------------------
  const ubc = createUniversity(db, {
    name: "University of British Columbia",
    shortName: "UBC",
    province: "British Columbia",
    officialAdmissionsUrl: "https://you.ubc.ca/",
  });

  const admissionCategory = createAdmissionCategory(db, {
    universityId: ubc.id,
    name: "Direct Entry — Engineering (Bachelor of Applied Science)",
    categoryType: "Direct-entry-program",
    description:
      "The path a Grade 12 (or equivalent) applicant applies through to enter UBC's Bachelor of Applied Science (Engineering) directly from secondary school, as opposed to transferring in from another faculty or institution.",
  });

  const program = createProgram(db, {
    universityId: ubc.id,
    primaryAdmissionCategoryId: admissionCategory.id,
    programName: "Engineering",
    degreeType: "Bachelor of Applied Science (BASc)",
  });

  // ---------------------------------------------------------------------
  // Sources — each with an explicit, non-default source_status reasoning.
  // See the final report for the plain-language version of this reasoning.
  // ---------------------------------------------------------------------

  const sourceDates = createSource(db, {
    title: "UBC Undergraduate Admissions — Dates and Deadlines",
    url: "https://you.ubc.ca/applying-ubc/dates-deadlines/",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "University of British Columbia — Undergraduate Admissions",
    academicYear: "2027 Entry (Winter Session September 2027 – April 2028)",
    publishedOrUpdatedDate: "2026-09-10",
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "CURRENT",
    sourceStatusReasoning:
      "The page's own dates table is explicitly labeled 'Winter Session (September 2027 to April 2028)' — the exact cycle this research targets, not inferred by us. Page metadata shows last-modified 2026-09-10T21:03:23Z, 11 days before retrieval. Marked CURRENT because the content is both self-labeled with the target academic year AND recently modified — not merely because the domain is ubc.ca.",
    researchSessionId: session.id,
  });

  const sourceHowToApply = createSource(db, {
    title: "UBC Engineering — How to Apply (Undergraduate)",
    url: "https://engineering.ubc.ca/admissions/undergraduate/how-to-apply",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "UBC Faculty of Applied Science — Engineering",
    academicYear: null,
    publishedOrUpdatedDate: null,
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "UNKNOWN",
    sourceStatusReasoning:
      "No explicit academic-year label or last-modified metadata was captured for this specific page during retrieval. Its described application steps and personal-profile requirement are consistent with the Sept-2027 cycle confirmed on the Dates & Deadlines source, but consistency with another source is not the same as a confirmed update date on this page itself. Marked UNKNOWN rather than CURRENT — being on engineering.ubc.ca does not earn it CURRENT by default.",
    researchSessionId: session.id,
  });

  const sourceCalendarAdmission = createSource(db, {
    title: "UBC Academic Calendar — Bachelor of Applied Science: Admission (2026/27 Calendar)",
    url: "https://vancouver.calendar.ubc.ca/faculties-colleges-and-schools/faculty-applied-science/bachelor-applied-science/admission",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "University of British Columbia — Vancouver Academic Calendar",
    academicYear: "2026/27 Calendar",
    publishedOrUpdatedDate: null,
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "POSSIBLY_OUTDATED",
    sourceStatusReasoning:
      "Confirmed via a separate search of vancouver.calendar.ubc.ca that this is the most recently published UBC Vancouver Academic Calendar edition as of retrieval — no 2027/28 edition exists yet. But the page is explicitly labeled '2026/27 Calendar', one cycle behind the September-2027-entry cohort this research targets. UBC has not confirmed whether Engineering's admission requirements for 2027/28 will be identical. Marked POSSIBLY_OUTDATED relative to THIS research's target year — not because the page is stale in absolute terms (it is UBC's current live calendar), but because 'the current calendar' and 'confirmed for the cycle being researched' are two different claims, and this project must not conflate them.",
    researchSessionId: session.id,
  });

  const sourceEnglishProficiency = createSource(db, {
    title: "UBC Academic Calendar — English Language Proficiency Tests",
    url: "https://vancouver.calendar.ubc.ca/admissions/english-language-admission-standard/english-language-proficiency-tests",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "University of British Columbia — Vancouver Academic Calendar",
    academicYear: null,
    publishedOrUpdatedDate: null,
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "UNKNOWN",
    sourceStatusReasoning:
      "The page does not state which Academic Calendar edition it belongs to, and a cross-reference search did not conclusively confirm 2025/26 vs 2026/27. Marked UNKNOWN rather than assumed CURRENT, per the explicit instruction not to default to CURRENT just because the domain is ubc.ca.",
    researchSessionId: session.id,
  });

  // ---------------------------------------------------------------------
  // Evidence — verbatim excerpts with real, specific locators.
  // ---------------------------------------------------------------------

  const evOpen = createEvidence(db, {
    sourceId: sourceDates.id,
    excerpt: "Online application opens for Winter Session (September 2027 to April 2028) and Summer Session (May to August 2027).",
    locator: "you.ubc.ca/applying-ubc/dates-deadlines/ — dates table, 'Preparation' row, first entry",
    capturedDate: RETRIEVED_DATE,
  });

  const evDeadline = createEvidence(db, {
    sourceId: sourceDates.id,
    excerpt: "January 15, 2027 (11:59 p.m. PST) — Application deadline",
    locator: "you.ubc.ca/applying-ubc/dates-deadlines/ — dates table, 'Application deadline' row",
    capturedDate: RETRIEVED_DATE,
  });

  const evPersonalProfile = createEvidence(db, {
    sourceId: sourceHowToApply.id,
    excerpt: "High school students will submit a personal profile, which requires short essay responses and share the names of two references.",
    locator: "engineering.ubc.ca/admissions/undergraduate/how-to-apply — application steps section, personal-profile paragraph",
    capturedDate: RETRIEVED_DATE,
  });

  const evCourses = createEvidence(db, {
    sourceId: sourceCalendarAdmission.id,
    excerpt: "applicants must have completed mathematics, physics, and chemistry at the BC Grade 12-level, or the equivalent.",
    locator: "vancouver.calendar.ubc.ca/faculties-colleges-and-schools/faculty-applied-science/bachelor-applied-science/admission — Admission section, BC/Yukon Grade 12 curriculum paragraph",
    capturedDate: RETRIEVED_DATE,
  });

  const evSelection = createEvidence(db, {
    sourceId: sourceCalendarAdmission.id,
    excerpt: "Students will be selected on the basis of their standing in Grade 12 courses in mathematics, chemistry, physics, and English.",
    locator: "vancouver.calendar.ubc.ca/faculties-colleges-and-schools/faculty-applied-science/bachelor-applied-science/admission — Admission section, selection-criteria paragraph immediately following the course requirement",
    capturedDate: RETRIEVED_DATE,
  });

  const evTransferGrades = createEvidence(db, {
    sourceId: sourceCalendarAdmission.id,
    excerpt:
      "An overall average of at least 65%, including any failed courses, is required. ... Applicants must achieve an average of at least 70% in each of these subject areas [chemistry, mathematics, physics].",
    locator: "vancouver.calendar.ubc.ca/faculties-colleges-and-schools/faculty-applied-science/bachelor-applied-science/admission — Admission section, Post-Secondary Transfer Requirements paragraph",
    capturedDate: RETRIEVED_DATE,
  });

  const evIelts = createEvidence(db, {
    sourceId: sourceEnglishProficiency.id,
    excerpt: "IELTS (Academic): 6.5 with no part less than 6.0",
    locator: "vancouver.calendar.ubc.ca/admissions/english-language-admission-standard/english-language-proficiency-tests — proficiency test score table, IELTS row",
    capturedDate: RETRIEVED_DATE,
  });

  // ---------------------------------------------------------------------
  // Facts — all NEEDS_REVIEW or NOT_VERIFIED. None are pre-verified: only
  // Wango, through the Browser UAT, can move any of these to VERIFIED.
  // ---------------------------------------------------------------------

  const factDeadline = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "application_deadline",
    value: "January 15, 2027, 11:59 p.m. Pacific Time — application deadline for Winter Session (September 2027 – April 2028) entry.",
    academicYear: "2027 Entry (Winter Session Sept 2027 – Apr 2028)",
    applicability: {
      province: null,
      campus: "Vancouver",
      admissionCategoryId: admissionCategory.id,
      intake: "September 2027",
    },
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [evOpen.id, evDeadline.id],
    researchSessionId: session.id,
  });

  const factCourses = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "required_high_school_courses",
    value:
      "Mathematics, Physics, and Chemistry at the BC Grade 12 level or equivalent; selection also weighs standing in English 12.",
    academicYear: "2026/27 Calendar (most current published UBC calendar as of 2026-09-21 — NOT explicitly confirmed for 2027 Entry; see Source 'Bachelor of Applied Science: Admission' reasoning)",
    applicability: {
      applicantType: ["Domestic"],
      province: "British Columbia/Yukon (or equivalent curriculum)",
      campus: "Vancouver",
      admissionCategoryId: admissionCategory.id,
    },
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [evCourses.id, evSelection.id],
    researchSessionId: session.id,
  });

  const factSupplementary = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "supplementary_application",
    value:
      "Required for applicants entering directly from secondary school: a personal profile with short essay responses and two references. Transfer applicants are typically not required to complete this step.",
    academicYear: "2027 Entry (Winter Session Sept 2027 – Apr 2028)",
    applicability: {
      applicantType: ["Domestic", "International"],
      admissionCategoryId: admissionCategory.id,
    },
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [evPersonalProfile.id],
    researchSessionId: session.id,
  });

  const factTransferGrades = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "grade_requirement_transfer_applicants",
    value: "Overall average of at least 65% (including any failed courses), and at least 70% in each of chemistry, mathematics, and physics.",
    academicYear: "2026/27 Calendar (see Source 'Bachelor of Applied Science: Admission' reasoning re: applicability to 2027 Entry)",
    applicability: {
      applicantType: ["Transfer"],
      admissionCategoryId: admissionCategory.id,
    },
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [evTransferGrades.id],
    researchSessionId: session.id,
  });

  // Deliberate gap: NOT_VERIFIED because no source states this — not because we forgot to look.
  const factDirectEntryGrade = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "grade_requirement_direct_entry",
    value:
      "NOT VERIFIED: no fixed minimum grade/percentage is published for applicants entering Engineering directly from secondary school. UBC describes this admission as 'competitive', based on standing in the required Grade 12 courses, with no stated cutoff. (A numeric minimum — 65% overall, 70% per subject — is stated explicitly, but only for post-secondary transfer applicants; see the separate transfer-applicant Fact.)",
    academicYear: "2026/27 Calendar",
    applicability: {
      applicantType: ["Domestic", "International"],
      admissionCategoryId: admissionCategory.id,
    },
    verificationStatus: "NOT_VERIFIED",
    extractedBy: "AI",
    evidenceIds: [], // No Source, No Fact — this absence-of-a-number is exactly why it's NOT_VERIFIED.
    researchSessionId: session.id,
  });

  const factEnglishProficiency = createFact(db, {
    entityType: "UNIVERSITY",
    entityId: ubc.id,
    fieldKey: "english_language_proficiency_requirement",
    value:
      "International applicants may demonstrate English competence via IELTS 6.5 overall (no band below 6.0), among other accepted pathways (TOEFL iBT 90, Duolingo English Test 125, PTE 65, CAEL 70, Cambridge English 180, or qualifying prior education/coursework — see evidence for the full list).",
    academicYear: "UBC Academic Calendar (edition not conclusively confirmed — see Source 'English Language Proficiency Tests' reasoning)",
    applicability: {
      applicantType: ["International"],
    },
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [evIelts.id],
    researchSessionId: session.id,
  });

  // ---------------------------------------------------------------------
  // Conflict — no genuine disagreement was found between the real UBC
  // sources above, so per instruction (8), this is an explicitly isolated
  // SIMULATED test fixture: fake sources, fake evidence, fake facts, none
  // of which touch the real UBC Facts created above.
  // ---------------------------------------------------------------------

  const simSourceA = createSource(db, {
    title: "SIMULATED SOURCE A — NOT REAL UBC PAGE (test fixture for Conflict handling)",
    url: "https://example-simulated.invalid/source-a",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "SIMULATED — test fixture, not a real publisher",
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "CURRENT",
    sourceStatusReasoning: "SIMULATED fixture — not a real retrieval; status is a placeholder for testing the Conflict pipeline only.",
    researchSessionId: session.id,
    notes: "SIMULATED — NOT REAL UBC SOURCE",
  });

  const simSourceB = createSource(db, {
    title: "SIMULATED SOURCE B — NOT REAL UBC PAGE (test fixture for Conflict handling)",
    url: "https://example-simulated.invalid/source-b",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "SIMULATED — test fixture, not a real publisher",
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "CURRENT",
    sourceStatusReasoning: "SIMULATED fixture — not a real retrieval; status is a placeholder for testing the Conflict pipeline only.",
    researchSessionId: session.id,
    notes: "SIMULATED — NOT REAL UBC SOURCE",
  });

  const simEvidenceA = createEvidence(db, {
    sourceId: simSourceA.id,
    excerpt: "SIMULATED: 'Chemistry 12 is specifically required; general science credit is not accepted.'",
    locator: "SIMULATED locator — test fixture, no real page exists",
    capturedDate: RETRIEVED_DATE,
    notes: "SIMULATED — NOT REAL UBC EVIDENCE",
  });

  const simEvidenceB = createEvidence(db, {
    sourceId: simSourceB.id,
    excerpt: "SIMULATED: 'Chemistry 12 or an equivalent Grade 12 laboratory science course is accepted.'",
    locator: "SIMULATED locator — test fixture, no real page exists",
    capturedDate: RETRIEVED_DATE,
    notes: "SIMULATED — NOT REAL UBC EVIDENCE",
  });

  const simFactA = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "simulated_test_case_prerequisite",
    value: "SIMULATED — NOT REAL UBC REQUIREMENT: Chemistry 12 specifically required.",
    academicYear: "SIMULATED TEST CASE",
    applicability: {},
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [simEvidenceA.id],
    researchSessionId: session.id,
  });

  const simFactB = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "simulated_test_case_prerequisite",
    value: "SIMULATED — NOT REAL UBC REQUIREMENT: Chemistry 12 or equivalent lab science accepted.",
    academicYear: "SIMULATED TEST CASE",
    applicability: {},
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [simEvidenceB.id],
    researchSessionId: session.id,
  });

  createConflict(db, {
    affectedFactIds: [simFactA.id, simFactB.id],
    sourceAId: simSourceA.id,
    sourceBId: simSourceB.id,
    conflictDescription:
      "SIMULATED — NOT REAL UBC CONFLICT. This is a test fixture demonstrating two disagreeing sources about a prerequisite. No genuine conflict was found among the real UBC sources researched in this session; this exists only to exercise the Conflict entity and its resolution workflow end-to-end.",
    detectedDate: RETRIEVED_DATE,
    isSimulated: true,
    simulatedLabel: "SIMULATED — NOT REAL UBC CONFLICT",
  });

  // ---------------------------------------------------------------------
  // A second, unrelated SIMULATED fixture demonstrating append-only
  // history (supersedeFact) — isolated from real UBC facts, same as the
  // conflict fixture above. No real re-research produced a second
  // academic-year value yet, so this is the only honest way to show the
  // history mechanic working end to end without fabricating a real one.
  // ---------------------------------------------------------------------

  const simSourceHistory = createSource(db, {
    title: "SIMULATED SOURCE C — NOT REAL UBC PAGE (test fixture for append-only history)",
    url: "https://example-simulated.invalid/source-c",
    sourceType: "UNIVERSITY_OFFICIAL",
    publisher: "SIMULATED — test fixture, not a real publisher",
    retrievedDate: RETRIEVED_DATE,
    sourceStatus: "CURRENT",
    sourceStatusReasoning: "SIMULATED fixture — not a real retrieval; status is a placeholder for testing the append-only history mechanic only.",
    researchSessionId: session.id,
    notes: "SIMULATED — NOT REAL UBC SOURCE",
  });

  const simEvidenceHistoryOld = createEvidence(db, {
    sourceId: simSourceHistory.id,
    excerpt: "SIMULATED: 'Test value for the 2026 cycle.'",
    locator: "SIMULATED locator — test fixture, no real page exists",
    capturedDate: RETRIEVED_DATE,
    notes: "SIMULATED — NOT REAL UBC EVIDENCE",
  });

  const simFactHistoryOld = createFact(db, {
    entityType: "PROGRAM",
    entityId: program.id,
    fieldKey: "simulated_test_case_history_demo",
    value: "SIMULATED — TEST VALUE for the 2026 cycle.",
    academicYear: "SIMULATED 2026 TEST CASE",
    applicability: {},
    verificationStatus: "NEEDS_REVIEW",
    extractedBy: "AI",
    evidenceIds: [simEvidenceHistoryOld.id],
    researchSessionId: session.id,
  });

  const simEvidenceHistoryNew = createEvidence(db, {
    sourceId: simSourceHistory.id,
    excerpt: "SIMULATED: 'Test value for the 2027 cycle (supersedes the 2026 value).'",
    locator: "SIMULATED locator — test fixture, no real page exists",
    capturedDate: RETRIEVED_DATE,
    notes: "SIMULATED — NOT REAL UBC EVIDENCE",
  });

  supersedeFact(db, {
    oldFactId: simFactHistoryOld.id,
    newValue: "SIMULATED — TEST VALUE for the 2027 cycle (supersedes the 2026 value).",
    newAcademicYear: "SIMULATED 2027 TEST CASE",
    newVerificationStatus: "NEEDS_REVIEW",
    newEvidenceIds: [simEvidenceHistoryNew.id],
    extractedBy: "AI",
    researchSessionId: session.id,
  });

  recomputeResearchSessionCounts(db, session.id);

  console.log("Seed complete.");
  console.log(`University: ${ubc.name} (${ubc.id})`);
  console.log(`AdmissionCategory: ${admissionCategory.name} (${admissionCategory.id})`);
  console.log(`Program: ${program.programName} (${program.id})`);
  console.log(`Research Session: ${session.id}`);
  console.log("Facts created (all start NEEDS_REVIEW or NOT_VERIFIED — none pre-verified):");
  for (const f of [factDeadline, factCourses, factSupplementary, factTransferGrades, factDirectEntryGrade, factEnglishProficiency]) {
    console.log(`  - [${f.verificationStatus}] ${f.fieldKey}: ${f.id}`);
  }
  console.log("Simulated conflict created between two isolated SIMULATED facts (not real UBC data).");
}

main();
