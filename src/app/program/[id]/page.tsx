import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getProgram, getAdmissionCategory, listFactsForEntity, getEvidence, getSource } from "@/db/repo";
import { StatusBadge } from "@/lib/badges";
import type { Source } from "@/db/types";

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const program = getProgram(db, id);
  if (!program) notFound();
  const category = getAdmissionCategory(db, program.primaryAdmissionCategoryId);
  const facts = listFactsForEntity(db, "PROGRAM", id);

  // Distinct sources cited by this program's facts.
  const sourceMap = new Map<string, Source>();
  for (const f of facts) {
    for (const evId of f.evidenceIds) {
      const ev = getEvidence(db, evId);
      if (!ev) continue;
      const src = getSource(db, ev.sourceId);
      if (src) sourceMap.set(src.id, src);
    }
  }
  const sources = Array.from(sourceMap.values());

  return (
    <>
      <div className="crumbs">
        <Link href="/">Universities</Link> / <Link href={`/university/${program.universityId}`}>University</Link> /{" "}
        <Link href={`/admission-category/${program.primaryAdmissionCategoryId}`}>{category?.name}</Link> / {program.programName}
      </div>
      <h1>
        {program.programName} ({program.degreeType})
      </h1>

      <h2>Facts</h2>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Status</th>
            <th>Academic Year</th>
            <th>Applicability</th>
          </tr>
        </thead>
        <tbody>
          {facts.map((f) => (
            <tr key={f.id}>
              <td>
                <Link href={`/fact/${f.id}`}>{f.fieldKey}</Link>
              </td>
              <td>
                <StatusBadge status={f.verificationStatus} />
              </td>
              <td style={{ maxWidth: 220 }}>{f.academicYear}</td>
              <td>
                {Array.isArray(f.applicability.applicantType) ? f.applicability.applicantType.join(", ") : f.applicability.applicantType}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Research Sources used for this Program</h2>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Source Status</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/source/${s.id}`}>{s.title}</Link>
              </td>
              <td>
                <StatusBadge status={s.sourceStatus} />
              </td>
              <td>{s.sourceType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
