import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getAdmissionCategory, getUniversity, listProgramsForAdmissionCategory } from "@/db/repo";

export default async function AdmissionCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const category = getAdmissionCategory(db, id);
  if (!category) notFound();
  const university = getUniversity(db, category.universityId);
  const programs = listProgramsForAdmissionCategory(db, id);

  return (
    <>
      <div className="crumbs">
        <Link href="/">Universities</Link> / <Link href={`/university/${category.universityId}`}>{university?.name}</Link> / {category.name}
      </div>
      <h1>{category.name}</h1>
      <p>
        Category type: <strong>{category.categoryType}</strong>
      </p>
      <p>{category.description}</p>

      <h2>Programs</h2>
      <table>
        <thead>
          <tr>
            <th>Program</th>
            <th>Degree</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/program/${p.id}`}>{p.programName}</Link>
              </td>
              <td>{p.degreeType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
