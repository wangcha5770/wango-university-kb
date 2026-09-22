import { writeFileSync } from "node:fs";
import { openDb } from "../db/client.js";
import {
  listUniversities,
  listAdmissionCategoriesForUniversity,
  listProgramsForAdmissionCategory,
  listFactsForEntity,
  listSources,
  listEvidenceForSource,
  listResearchSessions,
  listConflicts,
} from "../db/repo.js";

const db = openDb("data/kb.sqlite");
const universities = listUniversities(db);
const admissionCategories = universities.flatMap((u) => listAdmissionCategoriesForUniversity(db, u.id));
const programs = admissionCategories.flatMap((ac) => listProgramsForAdmissionCategory(db, ac.id));
const sources = listSources(db);
const evidence = sources.flatMap((s) => listEvidenceForSource(db, s.id));
const facts = [
  ...universities.flatMap((u) => listFactsForEntity(db, "UNIVERSITY", u.id)),
  ...admissionCategories.flatMap((ac) => listFactsForEntity(db, "ADMISSION_CATEGORY", ac.id)),
  ...programs.flatMap((p) => listFactsForEntity(db, "PROGRAM", p.id)),
];
const sessions = listResearchSessions(db);
const conflicts = listConflicts(db);

const out = { universities, admissionCategories, programs, sources, evidence, facts, sessions, conflicts };
writeFileSync("/tmp/kb-export.json", JSON.stringify(out, null, 2));
console.log(
  `exported ${facts.length} facts, ${sources.length} sources, ${evidence.length} evidence, ${conflicts.length} conflicts`
);
