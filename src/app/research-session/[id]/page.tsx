import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getResearchSession, listSources } from "@/db/repo";
import { StatusBadge } from "@/lib/badges";

export default async function ResearchSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const session = getResearchSession(db, id);
  if (!session) notFound();

  const sessionSources = listSources(db).filter((s) => s.researchSessionId === id);

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> / Research Session
      </div>
      <h1>{session.prompt}</h1>
      <table>
        <tbody>
          <tr>
            <th>Research date</th>
            <td>{session.researchDate}</td>
          </tr>
          <tr>
            <th>Sources found</th>
            <td>{session.sourcesFound}</td>
          </tr>
          <tr>
            <th>Evidence extracted</th>
            <td>{session.evidenceExtracted}</td>
          </tr>
          <tr>
            <th>Facts extracted</th>
            <td>{session.factsExtracted}</td>
          </tr>
          <tr>
            <th>Conflicts detected</th>
            <td>{session.conflictsDetected}</td>
          </tr>
          <tr>
            <th>Review status</th>
            <td>{session.reviewStatus}</td>
          </tr>
        </tbody>
      </table>

      <h2>Gaps identified during this session</h2>
      <ul>
        {session.gaps.map((g, i) => (
          <li key={i}>{g}</li>
        ))}
      </ul>

      <h2>Sources found in this session</h2>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sessionSources.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/source/${s.id}`}>{s.title}</Link>
              </td>
              <td>
                <StatusBadge status={s.sourceStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
