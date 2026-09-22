import Link from "next/link";
import { getDb } from "@/db/client";
import { listUniversities, listResearchSessions } from "@/db/repo";

export default function HomePage() {
  const db = getDb();
  const universities = listUniversities(db);
  const sessions = listResearchSessions(db);

  return (
    <>
      <h1>Wango University Knowledge Base</h1>
      <p style={{ color: "#666" }}>First Vertical Slice — UBC × Undergraduate Engineering Admission × Engineering × 2027</p>

      <h2>Universities</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Province</th>
          </tr>
        </thead>
        <tbody>
          {universities.map((u) => (
            <tr key={u.id}>
              <td>
                <Link href={`/university/${u.id}`}>{u.name}</Link>
              </td>
              <td>{u.province}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Research Sessions</h2>
      <table>
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Date</th>
            <th>Sources</th>
            <th>Evidence</th>
            <th>Facts</th>
            <th>Conflicts</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/research-session/${s.id}`}>{s.prompt}</Link>
              </td>
              <td>{s.researchDate}</td>
              <td>{s.sourcesFound}</td>
              <td>{s.evidenceExtracted}</td>
              <td>{s.factsExtracted}</td>
              <td>{s.conflictsDetected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
